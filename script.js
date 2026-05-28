const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isProcessing = false;

// 1. Live Layout System HUD Clock Logic
function updateHUDClock() {
    const clockElement = document.getElementById('live-clock');
    const now = new Date();
    if(clockElement) {
        clockElement.innerText = now.toTimeString().split(' ')[0];
    }
}
setInterval(updateHUDClock, 1000);
updateHUDClock();

// 2. Initializing Speech Configuration Setup with Fallback Protections
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
        document.body.classList.remove('listening');
        
        if (!event.results || !event.results[0] || !event.results[0][0]) {
            displayInternalSystemNotice("Telemetry matrix data missing. Please repeat parameter instruction.");
            return;
        }

        let userText = event.results[0][0].transcript;
        
        if (userText) {
            userText = userText.replace(/open/i, "open ").replace(/search/i, "search ").replace(/generate/i, "generate ").replace(/\s+/g, " ").trim();
        }

        if (!userText || userText.toLowerCase() === "undefined" || userText.trim() === "") {
            displayInternalSystemNotice("Telemetry matrix data missing. Please repeat parameter instruction.");
            return;
        }
        processMasterCommand(userText);
    };

    recognition.onerror = (event) => {
        document.body.classList.remove('listening');
        if (event.error === 'no-speech') {
            document.getElementById('status-text').innerText = "Initialize Voice Feed";
            isProcessing = false;
            return;
        }
        displayInternalSystemNotice(`Speech microphone interface hardware error: ${event.error}`);
    };
    
    recognition.onend = () => {
        if (!isProcessing) {
            document.getElementById('status-text').innerText = "Initialize Voice Feed";
        }
    };
}

function startListeningGate() {
    if (isProcessing) return;
    try {
        window.speechSynthesis.cancel(); 
        recognition.start();
        document.body.classList.add('listening');
        document.getElementById('status-text').innerText = "Listening...";
    } catch (e) { 
        try {
            recognition.stop();
            setTimeout(() => { recognition.start(); }, 100);
        } catch(err) { console.log("Audio collision resolved."); }
    }
}

// 3. UI Interactions Gateway
document.getElementById('startButton').addEventListener('click', startListeningGate);
window.addEventListener('keydown', (e) => { if (e.code === "Space") { e.preventDefault(); startListeningGate(); } });

document.getElementById('send-input-btn').addEventListener('click', () => {
    const inputField = document.getElementById('keyboard-input');
    if(inputField && inputField.value.trim()) {
        processMasterCommand(inputField.value.trim());
        inputField.value = "";
    }
});
const keyboardInput = document.getElementById('keyboard-input');
if (keyboardInput) {
    keyboardInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && e.target.value.trim()) {
            processMasterCommand(e.target.value.trim());
            e.target.value = "";
        }
    });
}

// 4. Central Platform Command Matrix Controller
async function processMasterCommand(userText) {
    isProcessing = true;
    const userSpeechEl = document.getElementById('user-speech');
    if (userSpeechEl) userSpeechEl.innerText = `"${userText}"`;
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.innerText = "Computing...";

    try {
        const intentResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2:3b',
                prompt: `Classify this query: "${userText}". You must output EXACTLY a valid JSON block and absolutely nothing else. No conversational chatter, no greeting, no markdown formatting.
                Formats to use strictly:
                If opening site/app: {"category": "system", "action": "open_website", "query": "target"}
                If searching web: {"category": "system", "action": "web_search", "query": "keywords"}
                If coding request: {"category": "generate", "type": "code", "prompt": "${escapeForJson(userText)}"}
                If image request: {"category": "generate", "type": "image", "prompt": "${escapeForJson(userText)}"}
                Otherwise: {"category": "generate", "type": "text", "prompt": "${escapeForJson(userText)}"}`,
                stream: false
            })
        });

        const intentData = await intentResponse.json();
        let rawText = intentData.response.trim();
        
        // UNBREAKABLE JSON REPAIR ENGINE
        const startIdx = rawText.indexOf('{');
        const endIdx = rawText.lastIndexOf('}');
        
        if (startIdx === -1 || endIdx === -1) {
            // Fallback Engine: Manual processing if the AI failed to generate JSON completely
            if (userText.toLowerCase().includes("image") || userText.toLowerCase().includes("draw") || userText.toLowerCase().includes("picture")) {
                const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category: "generate", type: "image", prompt: userText })
                });
                const assetData = await generateResponse.json();
                renderAssetToWorkspace("image", assetData);
                isProcessing = false;
                const finalStatusEl = document.getElementById('status-text');
                if (finalStatusEl) finalStatusEl.innerText = "Initialize Voice Feed";
                return;
            }
            throw new Error("Invalid format matrix response");
        }
        
        rawText = rawText.substring(startIdx, endIdx + 1);
        let intent;
        try {
            intent = JSON.parse(rawText);
        } catch (parseError) {
            console.error("JSON parse error:", parseError);
            throw new Error("Failed to parse intent classification response");
        }

        if (intent.category === 'system') {
            const backendResponse = await fetch('http://localhost:3000/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(intent)
            });
            if (!backendResponse.ok) throw new Error("System API error: " + backendResponse.status);
            const systemData = await backendResponse.json();
            renderSystemNotice(systemData.message);
        } else {
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(intent)
            });
            if (!generateResponse.ok) throw new Error("Generate API error: " + generateResponse.status);
            const assetData = await generateResponse.json();
            renderAssetToWorkspace(intent.type, assetData);
        }

    } catch (e) {
        console.error(e);
        displayInternalSystemNotice("Data indexing compilation structural fault. Local AI generated invalid code matrix: " + e.message);
    }
    isProcessing = false;
    const finalStatusEl = document.getElementById('status-text');
    if (finalStatusEl) finalStatusEl.innerText = "Initialize Voice Feed";
}

// Helper to escape strings for JSON
function escapeForJson(text) {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

// 5. Dynamic Workspace Render Engine
function renderAssetToWorkspace(type, data) {
    const viewport = document.getElementById('output-display');
    if (!viewport) return;
    if (data && data.speech) executeVoicePlayback(data.speech);

    const card = document.createElement('div');
    card.className = "response-card";

    if (type === 'code') {
        const content = (data && data.content) ? data.content : "";
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">Code</div>
                <div>
                    <h3 class="assistant-name">Source Code Architecture</h3>
                    <p class="timestamp-sub text-muted">Asset Compilation Complete</p>
                </div>
            </div>
            <pre><code id="target-code">${escapeHtml(content)}</code></pre>
            <div class="action-bar">
                <button class="ui-btn" onclick="navigator.clipboard.writeText(document.getElementById('target-code').innerText); alert('Copied!');">Copy Source Code</button>
            </div>
        `;
    } else if (type === 'image') {
        const url = (data && data.url) ? data.url : "";
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">Img</div>
                <div>
                    <h3 class="assistant-name">Graphics Processing Pipeline</h3>
                    <p class="timestamp-sub text-muted">Image Render Matrix Complete</p>
                </div>
            </div>
            <img src="${escapeHtml(url)}" class="canvas-img" crossorigin="anonymous" />
            <div class="action-bar">
                <button class="ui-btn" onclick="viewImageInLocalLightbox('${escapeHtml(url)}')">View Full-Res Image</button>
                <button class="ui-btn" onclick="downloadImageDirectly('${escapeHtml(url)}')">Download Image Asset</button>
            </div>
        `;
    } else {
        const content = (data && data.content) ? data.content : "";
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">AI</div>
                <div>
                    <h3 class="assistant-name">Assistant Documentation Response</h3>
                    <p class="timestamp-sub text-muted">Analysis Finished</p>
                </div>
            </div>
            <p style="white-space: pre-wrap; margin-top: 10px;">${escapeHtml(content)}</p>
            <div class="action-bar">
                <button class="ui-btn" onclick="navigator.clipboard.writeText(\`${escapeHtml(content)}\`); alert('Copied!');">Copy Workspace Text</button>
            </div>
        `;
    }
    viewport.prepend(card); 
}

function renderSystemNotice(message) {
    const viewport = document.getElementById('output-display');
    if (!viewport) return;
    if (message) executeVoicePlayback(message);
    const card = document.createElement('div');
    card.className = "response-card";
    card.innerHTML = `
        <div class="card-header-block">
            <div class="assistant-avatar" style="background: #10b981;">Sys</div>
            <div>
                <h3 class="assistant-name">System Environment Router</h3>
                <p class="timestamp-sub text-muted">Hardware Action Resolved</p>
            </div>
        </div>
        <p style="color: var(--accent-blue); font-family: monospace; font-size: 13px; margin: 10px 0 0 0;">${escapeHtml(message)}</p>`;
    viewport.prepend(card);
}

function displayInternalSystemNotice(msg) {
    if (msg) executeVoicePlayback(msg);
    const viewport = document.getElementById('output-display');
    if (!viewport) return;
    const card = document.createElement('div');
    card.className = "response-card";
    card.style.borderColor = "var(--alert-crimson)";
    card.innerHTML = `
        <div class="card-header-block">
            <div class="assistant-avatar" style="background: var(--alert-crimson);">!</div>
            <div>
                <h3 class="assistant-name" style="color: var(--alert-crimson);">System Exception Warning</h3>
                <p class="timestamp-sub text-muted">Action Terminated</p>
            </div>
        </div>
        <p style="color: var(--alert-crimson); font-family: monospace; font-size: 13px; margin: 10px 0 0 0;">${escapeHtml(msg)}</p>`;
    viewport.prepend(card);
    isProcessing = false;
}

function executeVoicePlayback(text) {
    if (!text) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const britishVoice = voices.find(v => v.lang && v.lang.includes('en-GB')) || voices[0];
    if (britishVoice) utterance.voice = britishVoice;
    synth.speak(utterance);
}

function viewImageInLocalLightbox(url) {
    const lightbox = document.createElement('div');
    lightbox.style.position = 'fixed';
    lightbox.style.top = '0';
    lightbox.style.left = '0';
    lightbox.style.width = '100vw';
    lightbox.style.height = '100vh';
    lightbox.style.backgroundColor = 'rgba(11, 14, 20, 0.95)';
    lightbox.style.display = 'flex';
    lightbox.style.justifyContent = 'center';
    lightbox.style.alignItems = 'center';
    lightbox.style.zIndex = '99999';
    lightbox.style.cursor = 'zoom-out';
    lightbox.innerHTML = `<img src="${escapeHtml(url)}" style="max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />`;
    lightbox.onclick = () => lightbox.remove();
    document.body.appendChild(lightbox);
}

async function downloadImageDirectly(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = `JARVIS_Generation_${Math.floor(Math.random() * 10000)}.jpg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(url, '_blank');
    }
}

function escapeHtml(text = "") {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

window.speechSynthesis.onvoiceschanged = () => { 
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices(); 
    }
};
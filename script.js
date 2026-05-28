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

// 2. Initializing Speech Configuration Setup
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
        document.body.classList.remove('listening');
        if (!event.results || !event.results[0] || !event.results[0][0]) return;
        let userText = event.results[0][0].transcript;
        if (!userText || userText.trim() === "") return;
        processMasterCommand(userText);
    };

    recognition.onerror = () => {
        document.body.classList.remove('listening');
        isProcessing = false;
        const statusEl = document.getElementById('status-text');
        if (statusEl) statusEl.innerText = "Initialize Voice Feed";
    };
    
    recognition.onend = () => {
        const statusEl = document.getElementById('status-text');
        if (!isProcessing && statusEl) statusEl.innerText = "Initialize Voice Feed";
    };
}

function startListeningGate() {
    if (isProcessing) return;
    if (!recognition) {
        displayInternalSystemNotice("Speech Recognition API not supported.");
        return;
    }
    window.speechSynthesis.cancel(); 
    try {
        recognition.start();
        document.body.classList.add('listening');
        const statusEl = document.getElementById('status-text');
        if (statusEl) statusEl.innerText = "Listening...";
    } catch (e) { 
        console.log("Mic reset completed."); 
    }
}

const startButton = document.getElementById('startButton');
if (startButton) startButton.addEventListener('click', startListeningGate);

window.addEventListener('keydown', (e) => { 
    if (e.code === "Space") { 
        e.preventDefault(); 
        startListeningGate(); 
    } 
});

// Keyboard Interface Inputs
const sendInputBtn = document.getElementById('send-input-btn');
if (sendInputBtn) {
    sendInputBtn.addEventListener('click', () => {
        const inputField = document.getElementById('keyboard-input');
        if (inputField && inputField.value.trim()) { 
            processMasterCommand(inputField.value.trim()); 
            inputField.value = ""; 
        }
    });
}

const keyboardInput = document.getElementById('keyboard-input');
if (keyboardInput) {
    keyboardInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && e.target.value.trim()) { 
            processMasterCommand(e.target.value.trim()); 
            e.target.value = ""; 
        }
    });
}

// 3. ZERO-AI CRASH INTENT ROUTER
async function processMasterCommand(userText) {
    isProcessing = true;
    const cleanText = userText.trim();
    const lowerText = cleanText.toLowerCase();
    
    const userSpeechEl = document.getElementById('user-speech');
    if (userSpeechEl) userSpeechEl.innerText = `"${cleanText}"`;
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.innerText = "Computing...";

    try {
        // ROUTE 1: IMAGE GENERATION MATRIX
        if (lowerText.startsWith("image ") || lowerText.startsWith("generate ") || lowerText.includes("picture of") || lowerText.includes("draw me")) {
            let imagePrompt = cleanText.replace(/generate image of/i, "").replace(/generate an image of/i, "").replace(/image of/i, "").replace(/generate/i, "").replace(/draw me/i, "").trim();
            
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "generate", type: "image", prompt: imagePrompt })
            });
            if (!generateResponse.ok) throw new Error("Generate API error");
            const assetData = await generateResponse.json();
            renderAssetToWorkspace("image", assetData);
        } 
        // ROUTE 2: DEVICE CONSOLE AUTOMATION / WEB OPEN
        else if (lowerText.startsWith("open ") || lowerText.startsWith("launch ") || lowerText.includes(".com") || lowerText.includes(".org")) {
            let systemTarget = cleanText.replace(/open /i, "").replace(/launch /i, "").trim();
            
            const backendResponse = await fetch('http://localhost:3000/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "system", action: "open_website", query: systemTarget })
            });
            if (!backendResponse.ok) throw new Error("System API error");
            const systemData = await backendResponse.json();
            renderSystemNotice(systemData.message);
        } 
        // ROUTE 3: INTERNET LOG SEARCH
        else if (lowerText.startsWith("search ") || lowerText.startsWith("google ")) {
            let searchTarget = cleanText.replace(/search /i, "").replace(/google /i, "").trim();
            
            const backendResponse = await fetch('http://localhost:3000/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "system", action: "web_search", query: searchTarget })
            });
            if (!backendResponse.ok) throw new Error("System API error");
            const systemData = await backendResponse.json();
            renderSystemNotice(systemData.message);
        } 
        // ROUTE 4: CODE ARCHITECTURE COMPILATION
        else if (lowerText.includes("write code") || lowerText.includes("program") || lowerText.includes("script")) {
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "generate", type: "code", prompt: cleanText })
            });
            if (!generateResponse.ok) throw new Error("Generate API error");
            const assetData = await generateResponse.json();
            renderAssetToWorkspace("code", assetData);
        } 
        // ROUTE 5: CHAT & DOCUMENTATION BLUEPRINTS
        else {
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "generate", type: "text", prompt: cleanText })
            });
            if (!generateResponse.ok) throw new Error("Generate API error");
            const assetData = await generateResponse.json();
            renderAssetToWorkspace("text", assetData);
        }
    } catch (e) {
        console.error(e);
        displayInternalSystemNotice("Interface bridge error. Verify node server.js is running: " + e.message);
    }
    
    isProcessing = false;
    const finalStatusEl = document.getElementById('status-text');
    if (finalStatusEl) finalStatusEl.innerText = "Initialize Voice Feed";
}

// 4. Dynamic Workspace Render Engine
function renderAssetToWorkspace(type, data) {
    const viewport = document.getElementById('output-display');
    if (!viewport) return;
    if (data && data.speech) executeVoicePlayback(data.speech);
    
    const card = document.createElement('div');
    card.className = "response-card";

    if (type === 'code') {
        const content = (data && data.content) ? data.content : "";
        card.innerHTML = `
            <div class="card-header-block"><div class="assistant-avatar">Code</div><div><h3 class="assistant-name">Source Code Architecture</h3><p class="timestamp-sub text-muted">Asset Compilation Complete</p></div></div>
            <pre><code id="target-code">${escapeHtml(content)}</code></pre>
            <div class="action-bar"><button class="ui-btn" onclick="navigator.clipboard.writeText(document.getElementById('target-code').innerText); alert('Copied!');">Copy Source Code</button></div>`;
    } else if (type === 'image') {
        const url = (data && data.url) ? data.url : "";
        card.innerHTML = `
            <div class="card-header-block"><div class="assistant-avatar">Img</div><div><h3 class="assistant-name">Graphics Processing Pipeline</h3><p class="timestamp-sub text-muted">Image Render Matrix Complete</p></div></div>
            <img src="${escapeHtml(url)}" class="canvas-img" crossorigin="anonymous" alt="Generated image" />
            <div class="action-bar"><button class="ui-btn" onclick="viewImageInLocalLightbox('${escapeHtml(url)}')">View Full-Res Image</button><button class="ui-btn" onclick="downloadImageDirectly('${escapeHtml(url)}')">Download Image Asset</button></div>`;
    } else {
        const content = (data && data.content) ? data.content : "";
        card.innerHTML = `
            <div class="card-header-block"><div class="assistant-avatar">AI</div><div><h3 class="assistant-name">Assistant Documentation Response</h3><p class="timestamp-sub text-muted">Analysis Finished</p></div></div>
            <p style="white-space: pre-wrap; margin-top: 10px;">${escapeHtml(content)}</p>
            <div class="action-bar"><button class="ui-btn" onclick="navigator.clipboard.writeText(\`${escapeHtml(content)}\`); alert('Copied!');">Copy Workspace Text</button></div>`;
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
        <div class="card-header-block"><div class="assistant-avatar" style="background: #10b981;">Sys</div><div><h3 class="assistant-name">System Environment Router</h3><p class="timestamp-sub text-muted">Hardware Action Resolved</p></div></div>
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
        <div class="card-header-block"><div class="assistant-avatar" style="background: var(--alert-crimson);">!</div><div><h3 class="assistant-name" style="color: var(--alert-crimson);">System Exception Warning</h3><p class="timestamp-sub text-muted">Action Terminated</p></div></div>
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
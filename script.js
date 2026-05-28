const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isProcessing = false;

function updateHUDClock() {
    const clockElement = document.getElementById('live-clock');
    const now = new Date();
    if(clockElement) {
        clockElement.innerText = now.toTimeString().split(' ')[0];
    }
}
setInterval(updateHUDClock, 1000);
updateHUDClock();

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

document.getElementById('startButton').addEventListener('click', startListeningGate);
window.addEventListener('keydown', (e) => { if (e.code === "Space") { e.preventDefault(); startListeningGate(); } });

document.getElementById('send-input-btn').addEventListener('click', () => {
    const inputField = document.getElementById('keyboard-input');
    if(inputField.value.trim()) {
        processMasterCommand(inputField.value.trim());
        inputField.value = "";
    }
});
document.getElementById('keyboard-input').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) {
        processMasterCommand(e.target.value.trim());
        e.target.value = "";
    }
});

async function processMasterCommand(userText) {
    isProcessing = true;
    document.getElementById('user-speech').innerText = `"${userText}"`;
    document.getElementById('status-text').innerText = "Computing...";

    try {
        const intentResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2:3b',
                prompt: `Classify this query: "${userText}". Output EXACTLY raw JSON. No chat text.
                Formats:
                If opening site/app: {"category": "system", "action": "open_website", "query": "target"}
                If searching web: {"category": "system", "action": "web_search", "query": "keywords"}
                If coding request: {"category": "generate", "type": "code", "prompt": "${userText}"}
                If image request: {"category": "generate", "type": "image", "prompt": "extract details"}
                Otherwise: {"category": "generate", "type": "text", "prompt": "${userText}"}`,
                stream: false
            })
        });

        const intentData = await intentResponse.json();
        let rawText = intentData.response.trim();
        
        const startIdx = rawText.indexOf('{');
        const endIdx = rawText.lastIndexOf('}');
        if(startIdx !== -1 && endIdx !== -1) rawText = rawText.substring(startIdx, endIdx + 1);

        const intent = JSON.parse(rawText);

        if (intent.category === 'system') {
            const backendResponse = await fetch('http://localhost:3000/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(intent)
            });
            const systemData = await backendResponse.json();
            renderSystemNotice(systemData.message);
        } else {
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(intent)
            });
            const assetData = await generateResponse.json();
            renderAssetToWorkspace(intent.type, assetData);
        }

    } catch (e) {
        console.error(e);
        displayInternalSystemNotice("Data indexing compilation structural fault.");
    }
    isProcessing = false;
    document.getElementById('status-text').innerText = "Initialize Voice Feed";
}

function renderAssetToWorkspace(type, data) {
    const viewport = document.getElementById('output-display');
    executeVoicePlayback(data.speech);

    const card = document.createElement('div');
    card.className = "response-card";

    if (type === 'code') {
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">Code</div>
                <div>
                    <h3 class="assistant-name">Source Code Architecture</h3>
                    <p class="timestamp-sub text-muted">Asset Compilation Complete</p>
                </div>
            </div>
            <pre><code id="target-code">${escapeHtml(data.content)}</code></pre>
            <div class="action-bar">
                <button class="ui-btn" onclick="navigator.clipboard.writeText(document.getElementById('target-code').innerText); alert('Copied!');">Copy Source Code</button>
            </div>
        `;
    } else if (type === 'image') {
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">Img</div>
                <div>
                    <h3 class="assistant-name">Graphics Processing Pipeline</h3>
                    <p class="timestamp-sub text-muted">Image Render Matrix Complete</p>
                </div>
            </div>
            <img src="${data.url}" class="canvas-img" />
            <div class="action-bar">
                <button class="ui-btn" onclick="window.open('${data.url}', '_blank')">View Full-Res Image</button>
            </div>
        `;
    } else {
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">AI</div>
                <div>
                    <h3 class="assistant-name">Assistant Documentation Response</h3>
                    <p class="timestamp-sub text-muted">Analysis Finished</p>
                </div>
            </div>
            <p style="white-space: pre-wrap; margin-top: 10px;">${data.content}</p>
            <div class="action-bar">
                <button class="ui-btn" onclick="navigator.clipboard.writeText(\`\${data.content}\`); alert('Copied!');">Copy Workspace Text</button>
            </div>
        `;
    }
    viewport.prepend(card); 
}

function renderSystemNotice(message) {
    const viewport = document.getElementById('output-display');
    executeVoicePlayback(message);
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
        <p style="color: var(--accent-blue); font-family: monospace; font-size: 13px; margin: 10px 0 0 0;">${message}</p>`;
    viewport.prepend(card);
}

function displayInternalSystemNotice(msg) {
    executeVoicePlayback(msg);
    const viewport = document.getElementById('output-display');
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
        <p style="color: var(--alert-crimson); font-family: monospace; font-size: 13px; margin: 10px 0 0 0;">${msg}</p>`;
    viewport.prepend(card);
    isProcessing = false;
}

function executeVoicePlayback(text) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const britishVoice = voices.find(v => v.lang.includes('en-GB')) || voices;
    if (britishVoice) utterance.voice = britishVoice;
    synth.speak(utterance);
}

function escapeHtml(text = "") {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
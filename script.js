const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isProcessing = false;

function updateHUDClock() {
    const clockElement = document.getElementById('live-clock');
    const now = new Date();
    if(clockElement) {
        clockElement.innerText = now.toTimeString().split(' ');
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
        let userText = event.results[0][0].transcript;
        if (!userText || userText.trim() === "") return;
        processMasterCommand(userText);
    };

    recognition.onerror = () => {
        document.body.classList.remove('listening');
        isProcessing = false;
        document.getElementById('status-text').innerText = "Initialize Voice Feed";
    };
    
    recognition.onend = () => {
        if (!isProcessing) document.getElementById('status-text').innerText = "Initialize Voice Feed";
    };
}

function startListeningGate() {
    if (isProcessing) return;
    window.speechSynthesis.cancel(); 
    try {
        recognition.start();
        document.body.classList.add('listening');
        document.getElementById('status-text').innerText = "Listening...";
    } catch (e) { console.log("Mic loop reset active."); }
}

document.getElementById('startButton').addEventListener('click', startListeningGate);
window.addEventListener('keydown', (e) => { if (e.code === "Space") { e.preventDefault(); startListeningGate(); } });

document.getElementById('send-input-btn').addEventListener('click', () => {
    const inputField = document.getElementById('keyboard-input');
    if(inputField.value.trim()) { processMasterCommand(inputField.value.trim()); inputField.value = ""; }
});
document.getElementById('keyboard-input').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) { processMasterCommand(e.target.value.trim()); e.target.value = ""; }
});

async function processMasterCommand(userText) {
    isProcessing = true;
    const cleanText = userText.trim();
    const lowerText = cleanText.toLowerCase();
    
    document.getElementById('user-speech').innerText = `"${cleanText}"`;
    document.getElementById('status-text').innerText = "Computing...";

    try {
        if (lowerText.startsWith("image ") || lowerText.startsWith("generate ") || lowerText.includes("picture of") || lowerText.includes("draw me")) {
            let imagePrompt = cleanText.replace(/generate image of/i, "").replace(/generate an image of/i, "").replace(/image of/i, "").replace(/generate/i, "").replace(/draw me/i, "").trim();
            
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "generate", type: "image", prompt: imagePrompt })
            });
            const assetData = await generateResponse.json();
            renderAssetToWorkspace("image", assetData);
        } 
        else if (lowerText.startsWith("open ") || lowerText.startsWith("launch ") || lowerText.includes(".com") || lowerText.includes(".org")) {
            let systemTarget = cleanText.replace(/open /i, "").replace(/launch /i, "").trim();
            const backendResponse = await fetch('http://localhost:3000/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "system", action: "open_website", query: systemTarget })
            });
            const systemData = await backendResponse.json();
            renderSystemNotice(systemData.message);
        } 
        else if (lowerText.startsWith("search ") || lowerText.startsWith("google ")) {
            let searchTarget = cleanText.replace(/search /i, "").replace(/google /i, "").trim();
            const backendResponse = await fetch('http://localhost:3000/api/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "system", action: "web_search", query: searchTarget })
            });
            const systemData = await backendResponse.json();
            renderSystemNotice(systemData.message);
        } 
        else if (lowerText.includes("write code") || lowerText.includes("program") || lowerText.includes("script")) {
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "generate", type: "code", prompt: cleanText })
            });
            const assetData = await generateResponse.json();
            renderAssetToWorkspace("code", assetData);
        } 
        else {
            const generateResponse = await fetch('http://localhost:3000/api/generate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: "generate", type: "text", prompt: cleanText })
            });
            const assetData = await generateResponse.json();
            renderAssetToWorkspace("text", assetData);
        }
    } catch (e) {
        console.error(e);
        displayInternalSystemNotice("Interface bridge connection error.");
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
            <div class="card-header-block"><div class="assistant-avatar">Code</div><div><h3 class="assistant-name">Source Code Architecture</h3><p class="timestamp-sub text-muted">Asset Compilation Complete</p></div></div>
            <pre><code id="target-code">${escapeHtml(data.content)}</code></pre>
            <div class="action-bar"><button class="ui-btn" onclick="navigator.clipboard.writeText(document.getElementById('target-code').innerText); alert('Copied!');">Copy Source Code</button></div>`;
    } else if (type === 'image') {
        card.innerHTML = `
            <div class="card-header-block"><div class="assistant-avatar">Img</div><div><h3 class="assistant-name">Graphics Processing Pipeline</h3><p class="timestamp-sub text-muted">Image Render Matrix Generating...</p></div></div>
            <div id="loader-placeholder" style="color: var(--accent-blue); font-family: monospace; font-size: 13px; padding: 20px 0; font-style: italic;">[ CONNECTING TO STREAM MATRIX TERMINAL... ]</div>
            <img src="${data.url}" class="canvas-img" id="live-target-canvas-render" style="display:none;" onload="revealLoadedImageMatrix()" crossorigin="anonymous" />
            <div class="action-bar" id="canvas-action-bar" style="display:none;">
                <button class="ui-btn" onclick="viewImageInLocalLightbox('${data.url}')">View Full-Res Image</button>
                <button class="ui-btn" onclick="downloadImageDirectly('${data.url}')">Download Image Asset</button>
            </div>`;
    } else {
        card.innerHTML = `
            <div class="card-header-block"><div class="assistant-avatar">AI</div><div><h3 class="assistant-name">Assistant Documentation Response</h3><p class="timestamp-sub text-muted">Analysis Finished</p></div></div>
            <p style="white-space: pre-wrap; margin-top: 10px;">${data.content}</p>
            <div class="action-bar"><button class="ui-btn" onclick="navigator.clipboard.writeText(\`${data.content}\`); alert('Copied!');">Copy Workspace Text</button></div>`;
    }
    viewport.prepend(card); 
}

function revealLoadedImageMatrix() {
    const loader = document.getElementById('loader-placeholder');
    const imageElement = document.getElementById('live-target-canvas-render');
    const actionBlock = document.getElementById('canvas-action-bar');
    
    if(loader) loader.style.display = 'none';
    if(imageElement) imageElement.style.display = 'block';
    if(actionBlock) actionBlock.style.display = 'flex';
}

function renderSystemNotice(message) {
    const viewport = document.getElementById('output-display');
    executeVoicePlayback(message);
    const card = document.createElement('div');
    card.className = "response-card";
    card.innerHTML = `
        <div class="card-header-block"><div class="assistant-avatar" style="background: #10b981;">Sys</div><div><h3 class="assistant-name">System Environment Router</h3><p class="timestamp-sub text-muted">Hardware Action Resolved</p></div></div>
        <p style="color: var(--accent-blue); font-family: monospace; font-size: 13px; margin: 10px 0 0 0;">${message}</p>`;
    viewport.prepend(card);
}

function displayInternalSystemNotice(msg) {
    executeVoicePlayback(msg);
    const viewport = document.getElementById('output-display');
    const card = document.createElement('div');
    card.className = "response-card";
    card.style.borderColor = "var(--alert-crimson)";
    card.innerHTML = `# !System Exception Warning\nAction Terminated ${msg}`;
    viewport.prepend(card);
    isProcessing = false;
}

function executeVoicePlayback(text) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const britishVoice = voices.find(v => v.lang.includes('en-GB')) || voices[0];
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
    lightbox.innerHTML = `<img src="${url}" style="max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />`;
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

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};
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
        let userText = event.results.transcript;
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

if(document.getElementById('startButton')) {
    document.getElementById('startButton').addEventListener('click', startListeningGate);
}
window.addEventListener('keydown', (e) => { if (e.code === "Space") { e.preventDefault(); startListeningGate(); } });

const inputField = document.getElementById('keyboard-input');
const sendBtn = document.getElementById('send-input-btn');

if(sendBtn) {
    sendBtn.addEventListener('click', () => {
        if(inputField && inputField.value.trim()) { processMasterCommand(inputField.value.trim()); inputField.value = ""; }
    });
}
if(inputField) {
    inputField.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && e.target.value.trim()) { processMasterCommand(e.target.value.trim()); e.target.value = ""; }
    });
}

async function processMasterCommand(userText) {
    isProcessing = true;
    const cleanText = userText.trim();
    const lowerText = cleanText.toLowerCase();
    
    if(document.getElementById('user-speech')) {
        document.getElementById('user-speech').innerText = `"${cleanText}"`;
    }
    if(document.getElementById('status-text')) {
        document.getElementById('status-text').innerText = "Computing...";
    }

    try {
        if (lowerText.startsWith("image ") || lowerText.startsWith("generate ") || lowerText.includes("picture of") || lowerText.includes("draw me")) {
            let imagePrompt = cleanText
                .replace(/generate image of/i, "")
                .replace(/generate an image of/i, "")
                .replace(/image of/i, "")
                .replace(/generate/i, "")
                .replace(/draw me/i, "")
                .trim();
            
            // Encode the keywords into lower-case alphanumeric formats
            let URLFriendlyPrompt = encodeURIComponent(imagePrompt.toLowerCase().replace(/[^a-z0-9\s]/g, ''));

            // FIXED ENDPOINT URL: Directly matching the active Pollinations rendering schema
            const liveImageUrl = "https://pollinations.ai" + URLFriendlyPrompt + "?width=1024&height=1024&nologo=true&seed=" + Math.floor(Math.random() * 99999);
            
            renderAssetToWorkspace("image", { url: liveImageUrl, speech: "I have successfully deployed the requested image array, Sir." });
        } 
        else {
            const cloudChatUrl = "https://pollinations.ai" + encodeURIComponent(cleanText) + "?system=You are JARVIS from Iron Man. Address the user as Sir. Respond concisely in two sentences.";
            
            const chatResponse = await fetch(cloudChatUrl);
            const chatText = await chatResponse.text();
            
            renderAssetToWorkspace("text", { content: chatText, speech: chatText });
        }
    } catch (e) {
        console.error(e);
        displayInternalSystemNotice("Cloud mainframe connection failed, Sir.");
    }
    
    isProcessing = false;
    if(document.getElementById('status-text')) {
        document.getElementById('status-text').innerText = "Initialize Voice Feed";
    }
}

// FIXED VISUAL DRAW ENGINE: Renders the image element instantly to prevent loading blocks
function renderAssetToWorkspace(type, data) {
    const viewport = document.getElementById('output-display');
    if(!viewport) return;
    
    executeVoicePlayback(data.speech);
    const card = document.createElement('div');
    card.className = "response-card";

    if (type === 'image') {
        // FIXED LAYOUT: Displays the image directly inside the card framework without forcing hidden styles
        card.innerHTML = `
            <div class="card-header-block">
                <div class="assistant-avatar">Img</div>
                <div>
                    <h3 class="assistant-name">Graphics Processing Pipeline</h3>
                    <p class="timestamp-sub text-muted">Image Render Matrix Complete</p>
                </div>
            </div>
            <img src="${data.url}" class="canvas-img" style="width: 100%; border-radius: 6px; margin: 15px 0; border: 1px solid var(--border-subtle); display: block;" />
            <div class="action-bar">
                <button class="ui-btn" onclick="viewImageInLocalLightbox('${data.url}')">View Full-Res Image</button>
                <button class="ui-btn" onclick="window.open('${data.url}', '_blank')">Open Original Tab</button>
            </div>`;
    } else {
        card.innerHTML = `
            <div class="card-header-block"><div class="assistant-avatar">AI</div><div><h3 class="assistant-name">Assistant Response</h3><p class="timestamp-sub text-muted">Analysis Finished</p></div></div>
            <p style="white-space: pre-wrap; margin-top: 10px; color: var(--text-main); font-family: inherit;">${data.content}</p>
            <div class="action-bar"><button class="ui-btn" id="copy-btn-${Math.floor(Math.random() * 1000)}">Copy Workspace Text</button></div>`;
    }
    viewport.prepend(card); 
}

function displayInternalSystemNotice(msg) {
    executeVoicePlayback(msg);
    const viewport = document.getElementById('output-display');
    if(!viewport) return;
    
    const card = document.createElement('div');
    card.className = "response-card";
    card.style.borderColor = "var(--alert-crimson)";
    card.innerHTML = `
        <div class="card-header-block"><div class="assistant-avatar" style="background: var(--alert-crimson);">!</div><div><h3 class="assistant-name" style="color: var(--alert-crimson);">System Exception Warning</h3><p class="timestamp-sub text-muted">Action Terminated</p></div></div>
        <p style="color: var(--alert-crimson); font-family: monospace; font-size: 13px; margin: 10px 0 0 0;">${msg}</p>`;
    viewport.prepend(card);
    isProcessing = false;
}

function executeVoicePlayback(text) {
    const synth = window.speechSynthesis;
    if(!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const britishVoice = voices.find(v => v.lang.includes('en-GB')) || voices;
    if (britishVoice) utterance.voice = britishVoice;
    synth.speak(utterance);
}

function viewImageInLocalLightbox(url) {
    const lightbox = document.createElement('div');
    lightbox.style.position = 'fixed'; lightbox.style.top = '0'; lightbox.style.left = '0'; lightbox.style.width = '100vw'; lightbox.style.height = '100vh'; lightbox.style.backgroundColor = 'rgba(11, 14, 20, 0.95)'; lightbox.style.display = 'flex'; lightbox.style.justifyContent = 'center'; lightbox.style.alignItems = 'center'; lightbox.style.zIndex = '99999'; lightbox.style.cursor = 'zoom-out';
    lightbox.innerHTML = `<img src="${url}" style="max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />`;
    lightbox.onclick = () => lightbox.remove();
    document.body.appendChild(lightbox);
}

function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
if(window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
}

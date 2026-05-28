const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Main Core Assets Assembly Route
app.post('/api/generate-asset', async (req, res) => {
    const { type, prompt } = req.body;
    console.log(`Mainframe asset command triggered -> Target Type: ${type}`);

    try {
        if (type === 'image') {
            // FORCE CLEANUP: Bypasses Llama formatting and directly reads your prompt
            let directPrompt = prompt || "futuristic city";
            
            // Clean out any weird characters or placeholders the AI might have accidentally left behind
            directPrompt = directPrompt.replace(/\{.*\}/g, "").trim(); 
            
            const cleanedKeywords = encodeURIComponent(directPrompt);
            
            // Unbreakable Direct URL Structure
            const liveImageUrl = `https://pollinations.ai{cleanedKeywords}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
            
            console.log(`Generated Direct URL -> ${liveImageUrl}`);

            return res.json({
                speech: "I have successfully deployed the requested image array, Sir.",
                url: liveImageUrl
            });
        }

        // Dynamic node-fetch importer for Llama communication
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        
        const aiResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2:3b',
                prompt: `You are J.A.R.V.I.S. assisting Tony Stark. Fulfill this system instruction completely: ${prompt}. Provide raw outputs directly without conversational chatter before or after.`,
                stream: false
            })
        });
        
        const aiData = await aiResponse.json();
        const contentOutput = aiData.response;

        if (type === 'code') {
            return res.json({ speech: "Source framework compilation finished, Sir.", content: contentOutput });
        }

        return res.json({ speech: "The data analysis sheet has been compiled, Sir.", content: contentOutput });

    } catch (error) {
        console.error("Assembly Route Crash: ", error);
        res.json({ speech: "Data compilation failure, Sir.", content: "Terminal Matrix Error." });
    }
});

// Device Shell Automation Controller Bridge
app.post('/api/system', async (req, res) => {
    const { action, query } = req.body;
    console.log(`Device Automation Protocol Triggered -> Action: ${action} | Target: ${query}`);

    try {
        let cleanQuery = query.toLowerCase().trim().replace(/https?:\/\//g, "").replace(/www\./g, "");
        
        if (action === 'web_search') {
            const searchUrl = `https://google.com{encodeURIComponent(query)}`;
            exec(`start "" "${searchUrl}"`);
            return res.json({ success: true, message: `Searching global database logs for "${query}", Sir.` });
        }

        if (cleanQuery.includes("linkedin")) cleanQuery = "linkedin.com";
        if (cleanQuery.includes("youtube")) cleanQuery = "youtube.com";
        if (cleanQuery.includes("github")) cleanQuery = "github.com";

        if (cleanQuery.includes(".com") || cleanQuery.includes(".org") || cleanQuery.includes(".net")) {
            exec(`start "" "https://${cleanQuery}"`);
            return res.json({ success: true, message: `Bypassing regional subnets to access ${cleanQuery} now, Sir.` });
        } else {
            exec(`start ${cleanQuery}`, (err) => {
                if (err) {
                    exec(`start "" "https://google.com{encodeURIComponent(query)}"`);
                }
            });
            return res.json({ success: true, message: `Initializing environment framework for application ${cleanQuery}, Sir.` });
        }
    } catch (e) {
        console.error("Automation Router Bridge Crash:", e);
        res.json({ success: false, message: "Bridge terminal linkage dropped, Sir." });
    }
});

app.listen(3000, () => console.log('JARVIS Global System Core running cleanly on Port 3000'));

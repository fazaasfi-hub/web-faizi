// ==========================================
// api/chat.js - Vercel Serverless Function
// Endpoint: POST /api/chat
// API Key aman tersimpan di Vercel Environment Variables
// ==========================================

const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

module.exports = async (req, res) => {
    // Allow CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "API Key belum dikonfigurasi di server." });
    }

    const requestBody = JSON.stringify({
        system_instruction: {
            parts: [{
                text: 'Kamu adalah konselor karir dan pendidikan yang ramah untuk website "Career Map / Peta Karir". Jawab pertanyaan pengguna dalam bahasa Indonesia dengan singkat (maksimal 3-4 poin atau 1 paragraf padat), terstruktur, dan memotivasi.'
            }]
        },
        contents: [{
            role: "user",
            parts: [{ text: message.trim() }]
        }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 450
        }
    });

    const options = {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody)
        }
    };

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const geminiReq = https.request(options, (geminiRes) => {
        geminiRes.on("data", (chunk) => res.write(chunk));
        geminiRes.on("end", () => res.end());
    });

    geminiReq.on("error", (err) => {
        console.error("Gemini error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Gagal terhubung ke Gemini API." });
        else res.end();
    });

    geminiReq.write(requestBody);
    geminiReq.end();
};

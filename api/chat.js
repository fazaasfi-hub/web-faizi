// ==========================================
// api/chat.js - Vercel Serverless Function
// Endpoint: POST /api/chat
// API Key aman tersimpan di Vercel Environment Variables
// ==========================================

const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.6-flash-lite";

module.exports = async (req, res) => {
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

    // Gunakan generateContent (non-streaming) — lebih stabil di Vercel serverless
    const options = {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody)
        }
    };

    const geminiRes = await new Promise((resolve, reject) => {
        const geminiReq = https.request(options, resolve);
        geminiReq.on("error", reject);
        geminiReq.write(requestBody);
        geminiReq.end();
    });

    let rawData = "";
    for await (const chunk of geminiRes) {
        rawData += chunk;
    }

    try {
        const parsed = JSON.parse(rawData);
        if (parsed.error) {
            return res.status(500).json({ error: parsed.error.message || "Gemini API error." });
        }
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.status(200).json({ text });
    } catch (e) {
        return res.status(500).json({ error: "Gagal parse response dari Gemini." });
    }
};

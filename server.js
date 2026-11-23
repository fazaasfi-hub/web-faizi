// ==========================================
// SERVER.JS - Backend Proxy untuk Gemini API
// API Key disimpan aman di sisi server (.env)
// ==========================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

// Middleware
app.use(cors({ origin: "*" })); // Bisa dibatasi ke domain tertentu jika sudah deploy
app.use(express.json());
app.use(express.static(".")); // Sajikan file statis (index.html, style.css, script.js)

// ==========================================
// ENDPOINT: POST /api/chat
// Menerima pesan dari frontend, forward ke Gemini, balas dengan stream SSE
// ==========================================
app.post("/api/chat", (req, res) => {
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

    // Set header untuk SSE agar frontend bisa baca stream secara real-time
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const geminiReq = https.request(options, (geminiRes) => {
        geminiRes.on("data", (chunk) => {
            res.write(chunk); // Forward chunk SSE langsung ke client
        });

        geminiRes.on("end", () => {
            res.end();
        });
    });

    geminiReq.on("error", (err) => {
        console.error("Gemini request error:", err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: "Gagal terhubung ke Gemini API." });
        } else {
            res.end();
        }
    });

    geminiReq.write(requestBody);
    geminiReq.end();
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`✅ Server berjalan di http://localhost:${PORT}`);
    console.log(`   API Key: ${GEMINI_API_KEY ? "✅ Terkonfigurasi" : "❌ BELUM DIISI di .env!"}`);
});

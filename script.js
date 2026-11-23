// ==========================================
// 1. KONFIGURASI - API dipanggil lewat backend proxy (server.js)
// API Key TIDAK lagi disimpan di frontend — aman dari inspeksi browser
// ==========================================
const API_ENDPOINT = "/api/chat"; // Endpoint backend lokal
let isGenerating = false;

function toggleAI() {
    const box = document.getElementById('ai-box');
    box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

// Fungsi bantu format teks ringan
function formatGeminiText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
}

async function askGemini() {
    if (isGenerating) return; // Cegah spam klik saat AI sedang menjawab

    const input = document.getElementById('ai-input');
    const msg = input.value.trim();
    if (!msg) return;

    const chatBox = document.getElementById('ai-messages');
    
    // Gunakan insertAdjacentHTML agar DOM lama tidak di-render ulang (lebih cepat dari +=)
    chatBox.insertAdjacentHTML('beforeend', `<div class="ai-msg-user"><b>Kamu:</b> ${msg}</div>`);
    input.value = '';

    const botMsgId = "bot-msg-" + Date.now();
    chatBox.insertAdjacentHTML(
        'beforeend',
        `<div id="${botMsgId}" class="ai-msg-bot" style="color:#64748b; font-size:13px;"><i>Mengetik...</i></div>`
    );
    chatBox.scrollTop = chatBox.scrollHeight;

    const botBubble = document.getElementById(botMsgId);

    isGenerating = true;
    input.disabled = true;

    try {
        // Kirim pesan ke backend proxy (server.js) — API Key aman di server
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `Gagal terhubung (${response.status})`);
        }

        // Cek apakah response benar-benar streaming (bukan error JSON)
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream")) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "API Key belum diset di server (cek Environment Variables Vercel).");
        }

        // Reset gaya bubble dari status "Mengetik..." ke tampilan pesan normal
        botBubble.removeAttribute("style");
        botBubble.innerHTML = `<b>Gemini AI:</b> `;

        // Membaca stream data secara real-time
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // Simpan sisa potongan baris yang belum lengkap

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        // Cek kalau Gemini balik error (misal API key salah)
                        if (parsed.error) {
                            throw new Error(parsed.error.message || "Gemini menolak permintaan.");
                        }
                        const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (chunkText) {
                            fullReply += chunkText;
                            botBubble.innerHTML = `<b>Gemini AI:</b> ${formatGeminiText(fullReply)}`;
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (e) {
                        if (e.message && !e.message.includes("JSON")) throw e;
                        // Abaikan potongan JSON parsial
                    }
                }
            }
        }
    } catch (error) {
        botBubble.style.color = "#dc2626";
        botBubble.style.fontSize = "13px";
        botBubble.innerHTML = `<b>Error:</b> ${error.message}`;
    } finally {
        isGenerating = false;
        input.disabled = false;
        input.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}
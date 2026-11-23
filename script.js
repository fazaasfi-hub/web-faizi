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
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Gagal terhubung (${response.status})`);
        }

        // Baca JSON response dari backend (non-streaming)
        const data = await response.json();
        if (!data.text) {
            throw new Error(data.error || "Gemini tidak memberikan jawaban.");
        }

        // Tampilkan jawaban
        botBubble.removeAttribute("style");
        botBubble.innerHTML = `<b>Gemini AI:</b> ${formatGeminiText(data.text)}`;
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
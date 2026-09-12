// ============================================================
// script1.js - Bridge Board Digitizer: API & Data Flow (v2.1)
// ============================================================

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Uygulama Durum Değişkenleri
let currentApiKey = localStorage.getItem("gemini_api_key") || "";
let tournamentBoards = JSON.parse(localStorage.getItem("bridge_tournament_boards") || "{}");
let currentHandsData = null;

document.addEventListener("DOMContentLoaded", () => {
    initApiKeyPanel();
    initBoardSelector();
    initAnalyzeButton();
});

// 1. API KEY SAKLAMA VE DOĞRULAMA
function initApiKeyPanel() {
    const apiKeyInput = document.getElementById("api-key-input");
    const btnSaveKey = document.getElementById("btn-save-key");

    if (currentApiKey) {
        apiKeyInput.value = currentApiKey;
        showApiStatus("API Key kayıtlı ve aktif.", "success");
    }

    btnSaveKey.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showApiStatus("Lütfen geçerli bir API Key giriniz.", "info");
            return;
        }
        currentApiKey = key;
        localStorage.setItem("gemini_api_key", key);
        showApiStatus("API Key başarıyla kaydedildi.", "success");
    });
}

function showApiStatus(msg, type) {
    const statusEl = document.getElementById("api-status");
    statusEl.style.display = "block";
    statusEl.textContent = msg;
    statusEl.className = `status-banner ${type === "success" ? "status-success" : "status-info"}`;
}

// 2. BORD NUMARASI VE TURNUVA YÖNETİMİ
function initBoardSelector() {
    const boardSelect = document.getElementById("board-number");
    boardSelect.innerHTML = "";
    for (let i = 1; i <= 32; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `Bord #${i}`;
        boardSelect.appendChild(opt);
    }

    boardSelect.addEventListener("change", (e) => {
        const bNum = e.target.value;
        if (tournamentBoards[bNum]) {
            loadBoardFromMemory(bNum);
        }
    });
}

// 3. GEMINI API ISTEK VE RETRY MEKANİZMASI
async function fetchWithRetry(url, options, maxRetries = 3, delayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return await response.json();
            }
            const errData = await response.json().catch(() => ({}));
            if (attempt === maxRetries) {
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }
        } catch (err) {
            if (attempt === maxRetries) throw err;
        }
        await new Promise(res => setTimeout(res, delayMs * attempt));
    }
}

// 4. DİNAMİK KADRAJLARDAN GEMINI İSTEĞİ GÖNDERME
function initAnalyzeButton() {
    const btnAnalyze = document.getElementById("btn-analyze");
    btnAnalyze.addEventListener("click", async () => {
        if (!currentApiKey) {
            alert("Lütfen öncelikle Gemini API Key kaydediniz!");
            return;
        }

        if (typeof getCroppedImagesPayload !== "function") {
            alert("Kadraj motoru (cropscript.js) yuklenemedi!");
            return;
        }

        const imagesPayload = getCroppedImagesPayload();
        if (!imagesPayload || imagesPayload.length === 0) {
            alert("Lütfen bir resim yukleyip kadraj alanlarini ayarlayin.");
            return;
        }

        btnAnalyze.disabled = true;
        btnAnalyze.textContent = "⏳ Gemini AI Görselleri Analiz Ediyor...";

        try {
            const handsResult = await analyzeImagesWithGemini(imagesPayload);
            currentHandsData = handsResult;
            
            if (typeof processAnalysisResult === "function") {
                processAnalysisResult(handsResult);
            }
        } catch (error) {
            console.error("Analiz Hatasi:", error);
            alert("Analiz sirasinda hata olustu: " + error.message);
        } finally {
            btnAnalyze.disabled = false;
            btnAnalyze.textContent = "🤖 Gemini ile Analiz Et ve Kartları Oku";
        }
    });
}

async function analyzeImagesWithGemini(imagesPayload) {
    const activePrompt = typeof singlePromptText !== "undefined" ? singlePromptText : promptText;

    const inlineDataParts = imagesPayload.map(imgBase64 => ({
        inline_data: {
            mime_type: "image/jpeg",
            data: imgBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "")
        }
    }));

    const requestBody = {
        contents: [{
            parts: [
                { text: activePrompt },
                ...inlineDataParts
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
        }
    };

    const url = `${GEMINI_API_URL}?key=${currentApiKey}`;
    const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini API boş yanıt döndürdü.");

    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
}

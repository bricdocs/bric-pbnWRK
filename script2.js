// ============================================================
// script2.js - Bridge Board Digitizer (Hatasız ve Eksiksiz Sürüm)
// ============================================================

let tournamentBoards = JSON.parse(localStorage.getItem("bridge_tournament_boards") || "{}");
let loadedImageBase64 = null;

document.addEventListener("DOMContentLoaded", () => {
    initApiKeyControls();
    initImageUpload();
    initPbnControls();
    initAnalyzer();
});

// 1. API KEY KONTROLLERİ
function initApiKeyControls() {
    const keyInput = document.getElementById("apiKeyInput");
    const saveBtn = document.getElementById("btn-save-key");
    if (keyInput && localStorage.getItem("gemini_api_key")) {
        keyInput.value = localStorage.getItem("gemini_api_key");
    }
    if (saveBtn && keyInput) {
        saveBtn.addEventListener("click", () => {
            const val = keyInput.value.trim();
            if (val) {
                localStorage.setItem("gemini_api_key", val);
                alert("API Key başarıyla kaydedildi!");
            } else {
                alert("Lütfen geçerli bir API Key girin.");
            }
        });
    }
}

// 2. FOTOĞRAF YÜKLEME VE ÖNİZLEME
function initImageUpload() {
    const imageInput = document.getElementById("imageInput");
    if (!imageInput) return;

    imageInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            loadedImageBase64 = event.target.result;
            const img = new Image();
            img.onload = function() {
                const canvas = document.getElementById("cropCanvas");
                const placeholder = document.getElementById("crop-placeholder");
                if (!canvas) return;

                const ctx = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                canvas.style.display = "block";
                if (placeholder) placeholder.style.display = "none";
            };
            img.src = loadedImageBase64;
        };
        reader.readAsDataURL(file);
    });
}

// 3. GEMINI YAPAY ZEKA ANALİZİ
function initAnalyzer() {
    const analyzeBtn = document.getElementById("btn-analyze");
    if (!analyzeBtn) return;

    analyzeBtn.addEventListener("click", async () => {
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            alert("Lütfen önce üst kısımdan Gemini API Key'inizi girip kaydedin!");
            return;
        }
        if (!loadedImageBase64) {
            alert("Lütfen önce bir bord fotoğrafı yükleyin!");
            return;
        }

        analyzeBtn.textContent = "Yapay Zeka Analiz Ediyor...";
        analyzeBtn.disabled = true;

        try {
            const base64Data = loadedImageBase64.split(',')[1];
            const mimeType = loadedImageBase64.substring(loadedImageBase64.indexOf(":") + 1, loadedImageBase64.indexOf(";"));

            const promptText = `Bu briç bordu fotoğrafındaki 4 yönün (North, East, South, West) kart dağılımını oku. 
Her yön için Maça (S), Kupa (H), Karo (D) ve Sinek (C) renklerindeki kartları eksiksiz listele.
Yanıtı SADECE şu JSON formatında ver, başka hiçbir açıklama yazma:
{
  "N": {"S": "AKQ", "H": "JT9", "D": "876", "C": "5432"},
  "E": {"S": "", "H": "", "D": "", "C": ""},
  "S": {"S": "", "H": "", "D": "", "C": ""},
  "W": {"S": "", "H": "", "D": "", "C": ""}
}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptText },
                            { inline_data: { mime_type: mimeType, data: base64Data } }
                        ]
                    }]
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }

            const rawText = data.candidates[0].content.parts[0].text;
            const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const hands = JSON.parse(jsonString);

            processAnalysisResult(hands);
        } catch (err) {
            console.error("Analiz hatası:", err);
            alert("Analiz sırasında hata oluştu: " + err.message);
        } finally {
            analyzeBtn.textContent = "🚀 Yapay Zeka ile Analiz Et";
            analyzeBtn.disabled = false;
        }
    });
}

// 4. ANALİZ SONUCU PANELİ AÇMA
function processAnalysisResult(hands) {
    document.getElementById("results-panel").style.display = "block";
    document.getElementById("pbn-panel").style.display = "block";
    document.getElementById("inspectorPanel").style.display = "block";

    renderHandsEditor(hands);
    renderHumanReadableHands(hands);
    validateAndUpdatePbn();
}

// 5. KART EDİTÖRÜ TABLOSU
function renderHandsEditor(hands) {
    const container = document.getElementById("hands-editor-container");
    container.innerHTML = "";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.background = "#0f172a";
    table.style.borderRadius = "8px";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr style="border-bottom: 1px solid #334155; color: #38bdf8; text-align: left;">
            <th style="padding: 10px;">Yön</th>
            <th style="padding: 10px;">♠ (Maça)</th>
            <th style="padding: 10px; color: #f87171;">♥ (Kupa)</th>
            <th style="padding: 10px; color: #fbbf24;">♦ (Karo)</th>
            <th style="padding: 10px;">♣ (Sinek)</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    PLAYERS.forEach(player => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #1e293b";

        let playerHtml = `<td style="padding: 10px; font-weight: bold; color: #cbd5e1;">${player}</td>`;

        SUITS.forEach(suit => {
            const val = (hands[player] && hands[player][suit]) ? hands[player][suit] : "";
            playerHtml += `
                <td style="padding: 6px;">
                    <input type="text" 
                           data-player="${player}" 
                           data-suit="${suit}" 
                           value="${val}" 
                           class="card-input"
                           style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #334155; background: #1e293b; color: #fff; text-transform: uppercase; font-weight: bold;">
                </td>
            `;
        });

        tr.innerHTML = playerHtml;
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    document.querySelectorAll(".card-input").forEach(input => {
        input.addEventListener("input", (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/10/g, 'T');
            validateAndUpdatePbn();
            renderHumanReadableHands(getHandsFromEditor());
        });
    });
}

// 6. GÖRSEL KONTROLÜ
function renderHumanReadableHands(parsedResults) {
    const container = document.getElementById('handsInspector');
    if (!container) return;
    let html = '';

    for (let dir of PLAYERS) {
        const hand = parsedResults[dir] || {};
        
        const cleanSuit = (val) => {
            if (!val || typeof val !== 'string') return "";
            return val.toUpperCase().replace(/[^AKQJT98765432]/g, '');
        };

        const formatCards = (str) => {
            const cleaned = cleanSuit(str);
            if (!cleaned) return '<span style="color:#94a3b8; font-size: 0.95rem;">— (Şikan)</span>';
            return cleaned.split('').join(' ');
        };

        html += `
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px;">
                <div style="font-weight: bold; color: #38bdf8; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">${seqLabels[dir]}</div>
                <div style="margin: 4px 0; font-family: monospace; font-size: 0.95rem;"><span style="color: #e2e8f0; font-weight: bold;">♠</span><span style="color: #f8fafc; margin-left: 6px;">${formatCards(hand.S)}</span></div>
                <div style="margin: 4px 0; font-family: monospace; font-size: 0.95rem;"><span style="color: #ef4444; font-weight: bold;">♥</span><span style="color: #f8fafc; margin-left: 6px;">${formatCards(hand.H)}</span></div>
                <div style="margin: 4px 0; font-family: monospace; font-size: 0.95rem;"><span style="color: #f59e0b; font-weight: bold;">♦</span><span style="color: #f8fafc; margin-left: 6px;">${formatCards(hand.D)}</span></div>
                <div style="margin: 4px 0; font-family: monospace; font-size: 0.95rem;"><span style="color: #e2e8f0; font-weight: bold;">♣</span><span style="color: #f8fafc; margin-left: 6px;">${formatCards(hand.C)}</span></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function getHandsFromEditor() {
    const hands = { N: {}, E: {}, S: {}, W: {} };
    document.querySelectorAll(".card-input").forEach(input => {
        const p = input.getAttribute("data-player");
        const s = input.getAttribute("data-suit");
        hands[p][s] = input.value.trim().toUpperCase();
    });
    return hands;
}

// 7. 52 KART DOĞRULAMA
function validateDeck(hands) {
    const foundCards = [];
    const duplicates = [];
    let totalCount = 0;

    PLAYERS.forEach(p => {
        SUITS.forEach(s => {
            const cardsStr = hands[p][s] || "";
            for (let char of cardsStr) {
                const card = s + char;
                totalCount++;
                if (foundCards.includes(card)) duplicates.push(card);
                else foundCards.push(card);
            }
        });
    });

    const missingCount = 52 - foundCards.length;
    const statusEl = document.getElementById("deck-validation-status");
    if (!statusEl) return false;

    if (totalCount === 52 && duplicates.length === 0 && missingCount === 0) {
        statusEl.style.background = "#065f46";
        statusEl.style.color = "#a7f3d0";
        statusEl.textContent = "✅ Tebrikler! 52 kart eksiksiz ve mükerrersiz doğrulandı.";
        return true;
    } else {
        statusEl.style.background = "#78350f";
        statusEl.style.color = "#fde68a";
        let msg = `⚠️ Kart Sayısı: ${totalCount}/52. `;
        if (duplicates.length > 0) msg += `Mükerrer: [${duplicates.join(", ")}] `;
        if (missingCount > 0) msg += `Eksik: ${missingCount}`;
        statusEl.textContent = msg;
        return false;
    }
}

// 8. PBN VE HAFIZA GÜNCELLEME
function validateAndUpdatePbn() {
    const hands = getHandsFromEditor();
    validateDeck(hands);

    const boardNo = document.getElementById("board-number").value;
    const pbnString = buildPbnString(boardNo, hands);

    document.getElementById("pbn-output").value = pbnString;
    saveBoardToMemory(boardNo, hands, pbnString);
}

function buildPbnString(boardNo, hands) {
    const formatHand = (p) => `${hands[p].S || ''}.${hands[p].H || ''}.${hands[p].D || ''}.${hands[p].C || ''}`;
    const dealStr = `N:${formatHand('N')} ${formatHand('E')} ${formatHand('S')} ${formatHand('W')}`;
    
    return `[Event "Bridge Board Digitizer Session"]
[Site "Local"]
[Date "${new Date().toISOString().split('T')[0]}"]
[Board "${boardNo}"]
[West "-"]
[North "-"]
[East "-"]
[South "-"]
[Dealer "N"]
[Vulnerable "None"]
[Deal "${dealStr}"]
[Scoring ""]
[Declarer ""]
[Contract ""]
[Result ""]
`;
}

function saveBoardToMemory(boardNo, hands, pbn) {
    tournamentBoards[boardNo] = { hands, pbn };
    localStorage.setItem("bridge_tournament_boards", JSON.stringify(tournamentBoards));
}

// 9. 4 YÖN GÖRSELİNİ TEK DOSYA OLARAK İNDİRME
function downloadFourDirectionsImage() {
    const boardNo = document.getElementById("board-number").value;
    const hands = getHandsFromEditor();

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Bord ${boardNo} - 4 Yön Briç Eli`, canvas.width / 2, 45);

    const positions = {
        N: { x: 400, y: 90, label: 'Kuzey (N)' },
        W: { x: 200, y: 280, label: 'Batı (W)' },
        E: { x: 600, y: 280, label: 'Doğu (E)' },
        S: { x: 400, y: 450, label: 'Güney (S)' }
    };

    Object.keys(positions).forEach(dir => {
        const pos = positions[dir];
        const hand = hands[dir] || {};

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pos.x - 170, pos.y - 15, 340, 140, 8);
        else ctx.rect(pos.x - 170, pos.y - 15, 340, 140);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pos.label, pos.x, pos.y + 10);

        ctx.font = '15px monospace';
        ctx.textAlign = 'left';
        
        const suitsData = [
            { symbol: '♠', val: hand.S || '—', color: '#e2e8f0', yOff: 35 },
            { symbol: '♥', val: hand.H || '—', color: '#ef4444', yOff: 60 },
            { symbol: '♦', val: hand.D || '—', color: '#f59e0b', yOff: 85 },
            { symbol: '♣', val: hand.C || '—', color: '#e2e8f0', yOff: 110 }
        ];

        suitsData.forEach(s => {
            ctx.fillStyle = s.color;
            ctx.fillText(s.symbol, pos.x - 150, pos.y + s.yOff);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(s.val, pos.x - 120, pos.y + s.yOff);
        });
    });

    const dataUrl = canvas.toDataURL('image/png');
    downloadFile(`Board_${boardNo}_Eller.png`, dataUrl, true);
}

// 10. TOPLU PBN BİRLEŞTİRİCİ
async function handlePbnBatchMerge(event) {
    const files = Array.from(event.target.files);
    const statusDiv = document.getElementById('mergeStatus');
    if (files.length === 0) return;

    statusDiv.style.display = 'block';
    statusDiv.style.background = '#1e3a8a';
    statusDiv.style.color = '#93c5fd';
    statusDiv.textContent = `${files.length} dosya birleştiriliyor...`;

    let fileContents = [];
    for (let file of files) {
        try {
            const text = await file.text();
            fileContents.push({ name: file.name, content: text.trim() });
        } catch (err) {
            console.error(`${file.name} okunamadı:`, err);
        }
    }

    fileContents.sort((a, b) => {
        const getNum = (str) => {
            const match = str.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
        return getNum(a.name) - getNum(b.name);
    });

    const combinedText = fileContents.map(f => f.content).join('\n\n');
    const todayStr = new Date().toISOString().split('T')[0];
    const mergedFileName = `${todayStr}_Turnuva_Birlesik.pbn`;

    downloadFile(mergedFileName, combinedText, false);

    statusDiv.style.background = '#065f46';
    statusDiv.style.color = '#a7f3d0';
    statusDiv.textContent = `✅ Başarıyla ${fileContents.length} bord birleştirildi ve indirildi!`;
    event.target.value = '';
}

function initPbnControls() {
    document.getElementById("btn-copy-pbn")?.addEventListener("click", () => {
        const pbnText = document.getElementById("pbn-output").value;
        navigator.clipboard.writeText(pbnText).then(() => alert("PBN panoya kopyalandı!"));
    });

    document.getElementById("btn-download-pbn")?.addEventListener("click", () => {
        const boardNo = document.getElementById("board-number").value;
        const pbnText = document.getElementById("pbn-output").value;
        downloadFile(`Board_${boardNo}.pbn`, pbnText);
    });

    document.getElementById("btn-download-image")?.addEventListener("click", () => {
        downloadFourDirectionsImage();
    });

    document.getElementById("btn-export-all-pbn")?.addEventListener("click", () => {
        const keys = Object.keys(tournamentBoards).sort((a, b) => Number(a) - Number(b));
        if (keys.length === 0) {
            alert("Hafızada kaydedilmiş bord bulunamadı.");
            return;
        }
        let fullPbn = "";
        keys.forEach(k => { fullPbn += tournamentBoards[k].pbn + "\n\n"; });
        downloadFile(`Tournament_All_Boards.pbn`, fullPbn);
    });

    document.getElementById("btn-reset-memory")?.addEventListener("click", () => {
        if (confirm("Tüm turnuva hafızası sıfırlanacak. Emin misiniz?")) {
            tournamentBoards = {};
            localStorage.removeItem("bridge_tournament_boards");
            alert("Hafıza sıfırlandı.");
            location.reload();
        }
    });

    document.getElementById("mergeFileInput")?.addEventListener("change", handlePbnBatchMerge);
}

function downloadFile(filename, content, isDataUrl = false) {
    const element = document.createElement('a');
    if (isDataUrl) {
        element.setAttribute('href', content);
    } else {
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    }
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

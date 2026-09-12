// ============================================================
// script2.js - Bridge Board Digitizer: Editor, Validation & PBN (v2.1)
// ============================================================

const SUITS = ['S', 'H', 'D', 'C'];
const PLAYERS = ['N', 'E', 'S', 'W'];

document.addEventListener("DOMContentLoaded", () => {
    initPbnControls();
});

// 1. GELDİĞİNDE EDİTÖRÜ DOLDURMA VE PANELİ AÇMA
function processAnalysisResult(hands) {
    document.getElementById("results-panel").style.display = "block";
    document.getElementById("pbn-panel").style.display = "block";

    renderHandsEditor(hands);
    validateAndUpdatePbn();
}

// 2. KART EDİTÖR TABLOSUNU ÇİZME
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
        });
    });
}

// 3. MEVCUT KARTLARI TOPLAMA
function getHandsFromEditor() {
    const hands = { N: {}, E: {}, S: {}, W: {} };
    document.querySelectorAll(".card-input").forEach(input => {
        const p = input.getAttribute("data-player");
        const s = input.getAttribute("data-suit");
        hands[p][s] = input.value.trim().toUpperCase();
    });
    return hands;
}

// 4. 52 KART DOĞRULAMA (validateDeck)
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
                if (foundCards.includes(card)) {
                    duplicates.push(card);
                } else {
                    foundCards.push(card);
                }
            }
        });
    });

    const missingCount = 52 - foundCards.length;
    const statusEl = document.getElementById("deck-validation-status");

    if (totalCount === 52 && duplicates.length === 0 && missingCount === 0) {
        statusEl.className = "status-banner status-success";
        statusEl.textContent = "✅ Tebrikler! 52 kart eksiksiz ve mükerrersiz doğrulandı.";
        return true;
    } else {
        statusEl.className = "status-banner status-info";
        let msg = `⚠️ Kart Sayısı: ${totalCount}/52. `;
        if (duplicates.length > 0) {
            msg += `Mükerrer Kartlar: [${duplicates.join(", ")}] `;
        }
        if (missingCount > 0) {
            msg += `Eksik Kart Sayısı: ${missingCount}`;
        }
        statusEl.textContent = msg;
        return false;
    }
}

// 5. PBN OLUŞTURMA VE GÜNCELLEME
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

// 6. TURNUVA HAFIZA KAYDI VE YÜKLEME
function saveBoardToMemory(boardNo, hands, pbn) {
    if (typeof tournamentBoards !== "undefined") {
        tournamentBoards[boardNo] = { hands, pbn };
        localStorage.setItem("bridge_tournament_boards", JSON.stringify(tournamentBoards));
    }
}

function loadBoardFromMemory(boardNo) {
    if (tournamentBoards && tournamentBoards[boardNo]) {
        const data = tournamentBoards[boardNo];
        renderHandsEditor(data.hands);
        document.getElementById("results-panel").style.display = "block";
        document.getElementById("pbn-panel").style.display = "block";
        document.getElementById("pbn-output").value = data.pbn;
        validateDeck(data.hands);
    }
}

function initPbnControls() {
    document.getElementById("btn-copy-pbn")?.addEventListener("click", () => {
        const pbnText = document.getElementById("pbn-output").value;
        navigator.clipboard.writeText(pbnText).then(() => {
            alert("PBN panoya kopyalandı!");
        });
    });

    document.getElementById("btn-download-pbn")?.addEventListener("click", () => {
        const boardNo = document.getElementById("board-number").value;
        const pbnText = document.getElementById("pbn-output").value;
        downloadFile(`Board_${boardNo}.pbn`, pbnText);
    });

    document.getElementById("btn-export-all-pbn")?.addEventListener("click", () => {
        const keys = Object.keys(tournamentBoards).sort((a, b) => Number(a) - Number(b));
        if (keys.length === 0) {
            alert("Hafızada kaydedilmiş bord bulunamadı.");
            return;
        }
        let fullPbn = "";
        keys.forEach(k => {
            fullPbn += tournamentBoards[k].pbn + "\n\n";
        });
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
}

function downloadFile(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

/**
 * BRIÇ ANALİZ MOTORU (BRIDGE BOARD ANALYZER)
 * Dosya: script.js * Versiyon: v1.39
 * Tanım: Briç masa fotoğraflarından kart tespiti, skor/AHP hesaplama,
 *        API entegrasyonu ve arayüz mantığını yöneten ana JavaScript dosyası.
 */

        const COMPLETED_BOARDS_KEY = "bridge_completed_boards_v1";
        const API_MODEL = "gemini-3.6-flash";
// Kırpma aracından gelecek veriler için küresel alan tanımı
window.handImages = { N: null, E: null, S: null, W: null };

        const handFiles = { N: null, E: null, S: null, W: null };
        let singleTableFile = null;
        let activeMode = '4photos';

        const seqDirections = ['N', 'E', 'S', 'W'];
        const seqLabels = { N: 'Kuzey (N)', E: 'Doğu (E)', S: 'Güney (S)', W: 'Batı (W)' };
        let currentSeqIndex = 0;
        let activeSingleDir = null;

        document.addEventListener('DOMContentLoaded', () => {
            const savedKey = localStorage.getItem('gemini_api_key');
            const apiKeyContent = document.getElementById('apiKeyContent');
            const badge = document.getElementById('apiKeyStatusBadge');

            if (savedKey) {
                document.getElementById('apiKey').value = savedKey;
                apiKeyContent.style.display = 'none';
                badge.innerText = "Kayıtlı ✓";
                badge.style.background = "#dcfce7";
                badge.style.color = "#166534";
            } else {
                apiKeyContent.style.display = 'flex';
                badge.innerText = "Gerekli !";
                badge.style.background = "#fee2e2";
                badge.style.color = "#991b1b";
            }

            populateBoardDropdown();
            updateSeqButtonState();
        });

        function switchMode(mode) {
            activeMode = mode;
            document.getElementById('tab4Photos').classList.toggle('active', mode === '4photos');
            document.getElementById('tabSingleTable').classList.toggle('active', mode === 'singleTable');

            document.getElementById('mode4PhotosArea').style.display = mode === '4photos' ? 'block' : 'none';
            document.getElementById('modeSingleTableArea').style.display = mode === 'singleTable' ? 'block' : 'none';
        }

        function toggleApiKeyPanel() {
            const content = document.getElementById('apiKeyContent');
            content.style.display = content.style.display === 'none' ? 'flex' : 'none';
        }

        function saveApiKey() {
            const key = document.getElementById('apiKey').value.trim();
            localStorage.setItem('gemini_api_key', key);
            const badge = document.getElementById('apiKeyStatusBadge');
            if (key) {
                badge.innerText = "Kayıtlı ✓";
                badge.style.background = "#dcfce7";
                badge.style.color = "#166534";
            }
        }

        function getCompletedBoards() {
            const stored = localStorage.getItem(COMPLETED_BOARDS_KEY);
            return stored ? JSON.parse(stored) : [];
        }

        function populateBoardDropdown() {
            const select = document.getElementById('boardNo');
            const completed = getCompletedBoards();
            let html = '';
            
            for (let i = 1; i <= 32; i++) {
                const isDone = completed.includes(i);
                const label = isDone ? `Bord ${i} (Tamamlandı ✓)` : `Bord ${i}`;
                html += `<option value="${i}">${label}</option>`;
            }
            select.innerHTML = html;
            checkSelectedBoardStatus();
        }

        function checkSelectedBoardStatus() {
            const select = document.getElementById('boardNo');
            const warningDiv = document.getElementById('boardWarning');
            const completed = getCompletedBoards();
            const selectedVal = parseInt(select.value, 10);

            if (completed.includes(selectedVal)) {
                warningDiv.style.display = 'block';
                warningDiv.innerText = `⚠️ Uyarı: Bord ${selectedVal} daha önce tamamlanmış görünüyor.`;
            } else {
                warningDiv.style.display = 'none';
            }
        }

        function resetTournamentHistory() {
            if (confirm("Yeni bir turnuvaya mı başlıyorsunuz? Tamamlanan tüm bord geçmişi sıfırlansın mı?")) {
                localStorage.removeItem(COMPLETED_BOARDS_KEY);
                populateBoardDropdown();
                alert("Turnuva hafızası sıfırlandı!");
            }
        }

        function setHandImage(dir, file) {
            if (!file) return;
            handFiles[dir] = file;
            const img = document.getElementById(`preview-${dir}`);
            if (img) {
                img.src = URL.createObjectURL(file);
                img.style.display = 'block';
            }
            const card = document.getElementById(`card-${dir}`);
            if (card) {
                card.classList.add('has-image');
            }
        }

        // Dosya isminden yön tespit etme
        function detectDirectionFromFileName(fileName) {
            const name = fileName.toUpperCase();
            if (name.includes('NORTH') || name.includes('KUZEY') || name.includes('_N.')) return 'N';
            if (name.includes('EAST') || name.includes('DOGU') || name.includes('DOĞU') || name.includes('_E.')) return 'E';
            if (name.includes('SOUTH') || name.includes('GUNEY') || name.includes('GÜNEY') || name.includes('_S.')) return 'S';
            if (name.includes('WEST') || name.includes('BATI') || name.includes('_W.')) return 'W';
            return null;
        }

        function handleBatchFileSelect(event) {
            const files = Array.from(event.target.files);
            if (files.length !== 4) {
                alert(`Lütfen tam olarak 4 adet fotoğraf seçiniz! (Seçilen: ${files.length})`);
                return;
            }

            const tempSlots = { N: null, E: null, S: null, W: null };
            const unassignedFiles = [];

            files.forEach(file => {
                const detectedDir = detectDirectionFromFileName(file.name);
                if (detectedDir && !tempSlots[detectedDir]) {
                    tempSlots[detectedDir] = file;
                } else {
                    unassignedFiles.push(file);
                }
            });

            seqDirections.forEach(dir => {
                if (!tempSlots[dir] && unassignedFiles.length > 0) {
                    tempSlots[dir] = unassignedFiles.shift();
                }
            });

            seqDirections.forEach(dir => setHandImage(dir, tempSlots[dir]));
            resetDropdownSelectors();
            currentSeqIndex = 4;
            updateSeqButtonState();
        }

        function resetDropdownSelectors() {
            seqDirections.forEach(dir => {
                const select = document.getElementById(`select-dir-${dir}`);
                if (select) select.value = dir;
            });
        }

        // Metin tabanlı yön takas (Swap) mantığı
        function handleDirSelectChange(targetSlot, selectedDir) {
            if (targetSlot === selectedDir) return;

            // Seçilen yönün şu an bulunduğu diğer kutuyu bul
            let otherSlot = null;
            seqDirections.forEach(dir => {
                if (dir !== targetSlot) {
                    const sel = document.getElementById(`select-dir-${dir}`);
                    if (sel && sel.value === selectedDir) {
                        otherSlot = dir;
                    }
                }
            });

            // Dosya nesnelerini takas et
            const tempFile = handFiles[targetSlot];
            handFiles[targetSlot] = handFiles[otherSlot];
            handFiles[otherSlot] = tempFile;

            // Önizleme görsellerini güncelle
            const imgTarget = document.getElementById(`preview-${targetSlot}`);
            const imgOther = document.getElementById(`preview-${otherSlot}`);

            if (handFiles[targetSlot]) {
                imgTarget.src = URL.createObjectURL(handFiles[targetSlot]);
                imgTarget.style.display = 'block';
                document.getElementById(`card-${targetSlot}`).classList.add('has-image');
            } else {
                imgTarget.src = '';
                imgTarget.style.display = 'none';
                document.getElementById(`card-${targetSlot}`).classList.remove('has-image');
            }

            if (handFiles[otherSlot]) {
                imgOther.src = URL.createObjectURL(handFiles[otherSlot]);
                imgOther.style.display = 'block';
                document.getElementById(`card-${otherSlot}`).classList.add('has-image');
            } else {
                imgOther.src = '';
                imgOther.style.display = 'none';
                document.getElementById(`card-${otherSlot}`).classList.remove('has-image');
            }

            // Diğer kutunun seçim değerini eski slotun değeri yap
            if (otherSlot) {
                const otherSelect = document.getElementById(`select-dir-${otherSlot}`);
                if (otherSelect) otherSelect.value = targetSlot;
            }
        }

        function triggerSeqCamera() {
            if (currentSeqIndex >= 4) currentSeqIndex = 0;
            document.getElementById('seqCameraInput').click();
        }

        function handleSeqCameraSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            setHandImage(seqDirections[currentSeqIndex], file);
            currentSeqIndex++;
            updateSeqButtonState();
            event.target.value = '';
        }

        function updateSeqButtonState() {
            const btn = document.getElementById('btnSeqCamera');
            const desc = document.getElementById('seqDesc');
            const resetBtn = document.getElementById('resetSeqBtn');

            if (currentSeqIndex < 4) {
                const nextDir = seqDirections[currentSeqIndex];
                btn.innerText = `📸 Sırayla Çek: ${seqLabels[nextDir]} (${currentSeqIndex + 1}/4)`;
                btn.style.background = '#16a34a';
                desc.innerText = `Sıradaki hedef: ${seqLabels[nextDir]}.`;
                resetBtn.style.display = currentSeqIndex > 0 ? 'inline-block' : 'none';
            } else {
                btn.innerText = `✅ 4 El Çekildi (Yeniden Çek)`;
                btn.style.background = '#0284c7';
                desc.innerText = `4 el hazır! "Bordu Çöz" butonuna basabilirsiniz.`;
                resetBtn.style.display = 'inline-block';
            }
        }

        function resetSeqFlow() {
            currentSeqIndex = 0;
            seqDirections.forEach(dir => {
                handFiles[dir] = null;
                const img = document.getElementById(`preview-${dir}`);
                img.src = '';
                img.style.display = 'none';
                document.getElementById(`card-${dir}`).classList.remove('has-image');
            });
            resetDropdownSelectors();
            updateSeqButtonState();
        }

        function triggerSingleUpload(dir) {
            activeSingleDir = dir;
            document.getElementById('singleFileInput').click();
        }

        function handleSingleFileSelect(event) {
            const file = event.target.files[0];
            if (file && activeSingleDir) setHandImage(activeSingleDir, file);
            event.target.value = '';
        }

        function handleSingleTableSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            singleTableFile = file;
            const img = document.getElementById('previewSingleTable');
            img.src = URL.createObjectURL(file);
            img.style.display = 'block';
            event.target.value = '';
        }

        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });
        }

        async function fetchWithRetry(url, options, maxRetries = 2, delayMs = 3000) {
            const statusBox = document.getElementById('status');
            for (let i = 0; i <= maxRetries; i++) {
                try {
                    const response = await fetch(url, options);
                    if (response.status === 503 && i < maxRetries) {
                        statusBox.innerText = `⚠️ Google sunucusu yoğun (503).\n${delayMs / 1000} saniye içinde tekrar deneniyor (${i + 1}/${maxRetries})...`;
                        await new Promise(res => setTimeout(res, delayMs));
                        continue;
                    }
                    return response;
                } catch (err) {
                    if (i === maxRetries) throw err;
                    await new Promise(res => setTimeout(res, delayMs));
                }
            }
        }

/**
 * GÜNCELLEME (v1.39 Kesin Çözüm): cropscript.js ve script.js arasındaki 
 * kapsam (scope) ve değişken izolasyonunu ortadan kaldıran güvenli processBoard fonksiyonu.
 */
async function processBoard() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

    if (!apiKey) {
        alert("Lütfen Gemini API Key giriniz!");
        if (typeof toggleApiKeyPanel === 'function') toggleApiKeyPanel();
        return;
    }

    const croppedData = window.handImages || (typeof handImages !== 'undefined' ? handImages : null);
    const isCroppedModeReady = croppedData && croppedData.N && croppedData.E && croppedData.S && croppedData.W;

    console.log("🚀 processBoard tetiklendi. Kırpılmış Veri Durumu:", isCroppedModeReady);

    if (!isCroppedModeReady) {
        if (activeMode === '4photos' && (!handFiles.N || !handFiles.E || !handFiles.S || !handFiles.W)) {
            alert("Lütfen 4 el fotoğrafını da tamamlayın!");
            return;
        }

        if (activeMode === 'singleTable' && !singleTableFile) {
            alert("Lütfen masanın tek kare fotoğrafını seçin veya çekin!");
            return;
        }
    }

    const btn = document.getElementById('btnProcess');
    const status = document.getElementById('status');
    const resultPanel = document.getElementById('resultPanel');
    const validationBox = document.getElementById('validationBox');
    const boardNoSelect = document.getElementById('boardNo');
    const pbnOutputArea = document.getElementById('pbnOutput');

    if (btn) btn.disabled = true;
    if (resultPanel) resultPanel.style.display = 'none';

    try {
        let partsPayload = [];

        if (isCroppedModeReady) {
            if (status) status.innerText = "1/2 ✂️ Kırpılmış 4 Yön Paketleniyor...";
            const cleanBase64 = (val) => val && val.includes(',') ? val.split(',')[1] : val;

            partsPayload = [
                { text: promptText },
                { text: "Kuzey Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64(croppedData.N) } },
                { text: "Doğu Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64(croppedData.E) } },
                { text: "Güney Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64(croppedData.S) } },
                { text: "Batı Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64(croppedData.W) } }
            ];
        } else if (activeMode === '4photos') {
            if (status) status.innerText = "1/2 📷 Fotoğraflar Paketleniyor...";
            const base64N = await fileToBase64(handFiles.N);
            const base64E = await fileToBase64(handFiles.E);
            const base64S = await fileToBase64(handFiles.S);
            const base64W = await fileToBase64(handFiles.W);

            partsPayload = [
                { text: promptText },
                { text: "Kuzey Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: base64N } },
                { text: "Doğu Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: base64E } },
                { text: "Güney Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: base64S } },
                { text: "Batı Eli Fotoğrafı:" },
                { inline_data: { mime_type: "image/jpeg", data: base64W } }
            ];
        } else {
            if (status) status.innerText = "1/2 🖼️ Masa Fotoğrafı Hazırlanıyor...";
            const base64Table = await fileToBase64(singleTableFile);

            partsPayload = [
                { text: singlePromptText },
                { inline_data: { mime_type: "image/jpeg", data: base64Table } }
            ];
        }

        if (status) status.innerText = `2/2 🚀 ${API_MODEL} Modeline İstek Gönderiliyor...`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${apiKey}`;

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: partsPayload }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.0
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawJsonText) throw new Error("Yapay zekadan geçerli yanıt alınamadı.");

        const parsedResults = JSON.parse(rawJsonText);

        if (status) status.innerText = "52 Kart Doğrulaması Yapılıyor...";
        const validation = validateDeck(parsedResults);
        
        if (validationBox) {
            validationBox.innerHTML = validation.html;
            validationBox.className = `validation-report ${validation.isPerfect ? 'success' : 'warning'}`;
        }

        const boardNo = boardNoSelect ? boardNoSelect.value : "1";
        const formattedHands = {};
        for (let dir of ['N', 'E', 'S', 'W']) {
            const h = parsedResults[dir] || {};
            formattedHands[dir] = `${formatSuitForPbn(h.S)}.${formatSuitForPbn(h.H)}.${formatSuitForPbn(h.D)}.${formatSuitForPbn(h.C)}`;
        }

        const pbnText = buildPbnString(boardNo, formattedHands.N, formattedHands.E, formattedHands.S, formattedHands.W);
        if (pbnOutputArea) pbnOutputArea.value = pbnText;
        
        if (typeof renderHumanReadableHands === 'function') {
            renderHumanReadableHands(parsedResults);
        }

        if (resultPanel) resultPanel.style.display = 'block';
        if (status) status.innerText = "✅ İşlem Başarıyla Tamamlandı!";

    } catch (err) {
        console.error(err);
        if (status) status.innerText = "❌ Hata Oluştu:\n" + (err.message || err.toString());
    } finally {
        if (btn) btn.disabled = false;
    }
}

        function renderHumanReadableHands(parsedResults) {
            const container = document.getElementById('handsInspector');
            let html = '';

            for (let dir of ['N', 'E', 'S', 'W']) {
                const hand = parsedResults[dir] || {};
                
                const formatCards = (str) => {
                    const cleaned = cleanSuit(str);
                    if (!cleaned) return '<span style="color:#94a3b8; font-size: 0.95rem;">— (Şikan)</span>';
                    return cleaned.split('').join(' ');
                };

                html += `
                    <div class="inspector-hand">
                        <div class="inspector-hand-title">${seqLabels[dir]}</div>
                        <div class="suit-line">
                            <span class="suit-sym suit-black">♠</span>
                            <span class="suit-cards">${formatCards(hand.S)}</span>
                        </div>
                        <div class="suit-line">
                            <span class="suit-sym suit-red">♥</span>
                            <span class="suit-cards">${formatCards(hand.H)}</span>
                        </div>
                        <div class="suit-line">
                            <span class="suit-sym suit-red">♦</span>
                            <span class="suit-cards">${formatCards(hand.D)}</span>
                        </div>
                        <div class="suit-line">
                            <span class="suit-sym suit-black">♣</span>
                            <span class="suit-cards">${formatCards(hand.C)}</span>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        }

        function cleanSuit(val) {
            if (!val || typeof val !== 'string') return "";
            return val.toUpperCase().replace(/[^AKQJT98765432]/g, '');
        }

        function formatSuitForPbn(val) {
            const cleaned = cleanSuit(val);
            return cleaned.length > 0 ? cleaned : "-";
        }

        function validateDeck(rawResults) {
            const suitNames = { S: 'Maça (♠)', H: 'Kupa (♥)', D: 'Karo (♦)', C: 'Sinek (♣)' };
            const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
            const suits = ['S', 'H', 'D', 'C'];

            const cardMap = {};
            suits.forEach(s => {
                ranks.forEach(r => { cardMap[`${s}_${r}`] = []; });
            });

            const handCounts = { N: 0, E: 0, S: 0, W: 0 };
            let totalCardsFound = 0;

            for (let dir of ['N', 'E', 'S', 'W']) {
                const handObj = rawResults[dir] || {};
                suits.forEach(s => {
                    const suitCards = cleanSuit(handObj[s]);
                    for (let char of suitCards) {
                        handCounts[dir]++;
                        totalCardsFound++;
                        const key = `${s}_${char}`;
                        if (cardMap[key]) cardMap[key].push(seqLabels[dir]);
                    }
                });
            }

            const duplicates = [];
            const missing = [];

            for (let key in cardMap) {
                const [s, r] = key.split('_');
                const rankName = r === 'T' ? 'T (10)' : r;
                const cardLabel = `${suitNames[s]} ${rankName}`;

                if (cardMap[key].length > 1) {
                    duplicates.push(`${cardLabel} (${cardMap[key].join(', ')} ellerinde)`);
                } else if (cardMap[key].length === 0) {
                    missing.push(cardLabel);
                }
            }

            let isPerfect = (totalCardsFound === 52) && (duplicates.length === 0) && (missing.length === 0);
            let reportHtml = `<strong>Bord Doğrulama Analizi:</strong><br>`;

            if (isPerfect) {
                reportHtml += `✅ <strong>Mükemmel!</strong> 52 kartın tamamı hatasız ve eksiksiz tespit edildi.`;
                return { isPerfect: true, html: reportHtml };
            }

            let issues = [];
            let countIssues = [];
            for (let dir of ['N', 'E', 'S', 'W']) {
                if (handCounts[dir] !== 13) {
                    countIssues.push(`${seqLabels[dir]}: ${handCounts[dir]} kart`);
                }
            }
            if (countIssues.length > 0) {
                issues.push(`⚠️ <strong>Kart Sayısı Uyuşmazlığı:</strong> ${countIssues.join(', ')} (Her el 13 olmalı).`);
            }
            if (duplicates.length > 0) {
                issues.push(`❌ <strong>Çift Okunan Kartlar:</strong> ${duplicates.join('; ')}.`);
            }
            if (missing.length > 0 && missing.length <= 8) {
                issues.push(`🔍 <strong>Eksik Kartlar:</strong> ${missing.join(', ')}.`);
            } else if (missing.length > 8) {
                issues.push(`🔍 <strong>Eksik Kart Sayısı:</strong> ${missing.length} kart bulunamadı.`);
            }

            reportHtml += issues.join('<br>');
            return { isPerfect: false, html: reportHtml };
        }

        function buildPbnString(boardNo, n, e, s, w) {
            const dealers = ['N', 'E', 'S', 'W'];
            const dealer = dealers[(parseInt(boardNo) - 1) % 4];
            const vulPattern = ['None', 'NS', 'EW', 'All', 'NS', 'EW', 'All', 'None', 'EW', 'All', 'None', 'NS', 'All', 'None', 'NS', 'EW'];
            const vul = vulPattern[(parseInt(boardNo) - 1) % 16];
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');

            return `[Event "Bridge Hand Digitizer"]
[Site "Mobile Web App"]
[Date "${today}"]
[Board "${boardNo}"]
[West "-"]
[North "-"]
[East "-"]
[South "-"]
[Dealer "${dealer}"]
[Vulnerable "${vul}"]
[Deal "N:${n} ${e} ${s} ${w}"]`;
        }

        function copyPbn() {
            const textarea = document.getElementById('pbnOutput');
            textarea.select();
            document.execCommand('copy');
            alert("PBN metni kopyalandı!");
        }

        async function generateAndDownloadArchiveImage(boardNo) {
            if (activeMode === 'singleTable' && singleTableFile) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(singleTableFile);
                a.download = `Bord_${boardNo}_Arsiv.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            }

            const directions = ['N', 'E', 'S', 'W'];
            const labels = ['KUZEY (N)', 'DOĞU (E)', 'GÜNEY (S)', 'BATI (W)'];
            const targetWidth = 1200;
            const labelHeight = 60;
            const boardBannerHeight = 80;

            let processedPanels = [];
            let totalHeight = boardBannerHeight;

            for (let i = 0; i < 4; i++) {
                const dir = directions[i];
                if (!handFiles[dir]) return;

                const img = await new Promise((resolve) => {
                    const url = URL.createObjectURL(handFiles[dir]);
                    const im = new Image();
                    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
                    im.onerror = () => resolve(null);
                    im.src = url;
                });

                if (!img) return;

                const w = img.naturalWidth;
                const h = img.naturalHeight;

                const panelCanvas = document.createElement('canvas');
                const pCtx = panelCanvas.getContext('2d');
                panelCanvas.width = w;
                panelCanvas.height = h;
                pCtx.drawImage(img, 0, 0);

                const finalCanvas = document.createElement('canvas');
                const fCtx = finalCanvas.getContext('2d');
                const finalHeight = targetWidth * (h / w);

                finalCanvas.width = targetWidth;
                finalCanvas.height = finalHeight;
                fCtx.drawImage(panelCanvas, 0, 0, targetWidth, finalHeight);

                processedPanels.push({ label: labels[i], canvas: finalCanvas, height: finalHeight });
                totalHeight += labelHeight + finalHeight;
            }

            const masterCanvas = document.createElement('canvas');
            masterCanvas.width = targetWidth;
            masterCanvas.height = totalHeight;
            const ctx = masterCanvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetWidth, totalHeight);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, targetWidth, boardBannerHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`BRİÇ TURNUVASI - BORD ${boardNo} ARŞİVİ`, targetWidth / 2, boardBannerHeight / 2);

            let currentY = boardBannerHeight;
            for (let panel of processedPanels) {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, currentY, targetWidth, labelHeight);
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 26px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`  ${panel.label}`, 30, currentY + labelHeight / 2);

                currentY += labelHeight;
                ctx.drawImage(panel.canvas, 0, currentY);
                currentY += panel.height;
            }

            const dataUrl = masterCanvas.toDataURL('image/jpeg', 0.95);
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `Bord_${boardNo}_Arsiv.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        async function downloadSinglePbn() {
            const pbnText = document.getElementById('pbnOutput').value;
            const boardNo = parseInt(document.getElementById('boardNo').value, 10);
            if (!pbnText) return;

            const blob = new Blob([pbnText], { type: 'application/octet-stream;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BORD_${boardNo}.pbn`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            await generateAndDownloadArchiveImage(boardNo);

            let completed = getCompletedBoards();
            if (!completed.includes(boardNo)) {
                completed.push(boardNo);
                localStorage.setItem(COMPLETED_BOARDS_KEY, JSON.stringify(completed));
            }
            
            populateBoardDropdown();

            if (boardNo < 32) {
                document.getElementById('boardNo').value = boardNo + 1;
                checkSelectedBoardStatus();
            }
        }

        async function handlePbnBatchMerge(event) {
            const files = Array.from(event.target.files);
            const statusDiv = document.getElementById('mergeStatus');
            if (files.length === 0) return;

            statusDiv.innerText = `${files.length} dosya birleştiriliyor...`;

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

            const blob = new Blob([combinedText], { type: 'application/octet-stream;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = mergedFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusDiv.innerText = `✅ Başarıyla ${fileContents.length} bord birleştirildi ve "${mergedFileName}" olarak indirildi!`;
            event.target.value = '';
        }

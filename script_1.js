        const COMPLETED_BOARDS_KEY = "bridge_completed_boards_v1";
        const API_MODEL = "gemini-3.6-flash";

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

        async function processBoard() {
            const apiKey = document.getElementById('apiKey').value.trim();

            if (!apiKey) {
                alert("Lütfen Gemini API Key giriniz!");
                toggleApiKeyPanel();
                return;
            }

            if (activeMode === '4photos' && (!handFiles.N || !handFiles.E || !handFiles.S || !handFiles.W)) {
                alert("Lütfen 4 el fotoğrafını da tamamlayın!");
                return;
            }

            if (activeMode === 'singleTable' && !singleTableFile) {
                alert("Lütfen masanın tek kare fotoğrafını seçin veya çekin!");
                return;
            }

            const btn = document.getElementById('btnProcess');
            const status = document.getElementById('status');
            const resultPanel = document.getElementById('resultPanel');
            const validationBox = document.getElementById('validationBox');

            btn.disabled = true;
            resultPanel.style.display = 'none';

            try {
                let partsPayload = [];

                if (activeMode === '4photos') {
                    status.innerText = "1/2 📷 Fotoğraflar Paketleniyor...";
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
                    status.innerText = "1/2 🖼️ Masa Fotoğrafı Hazırlanıyor...";
                    const base64Table = await fileToBase64(singleTableFile);

                    partsPayload = [
                        { text: singlePromptText },
                        { inline_data: { mime_type: "image/jpeg", data: base64Table } }
                    ];
                }

                status.innerText = `2/2 🚀 ${API_MODEL} Modeline İstek Gönderiliyor...`;
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

                status.innerText = "52 Kart Doğrulaması Yapılıyor...";
                const validation = validateDeck(parsedResults);
                validationBox.innerHTML = validation.html;
                validationBox.className = `validation-report ${validation.isPerfect ? 'success' : 'warning'}`;

                const boardNo = document.getElementById('boardNo').value;
                const formattedHands = {};
                for (let dir of ['N', 'E', 'S', 'W']) {
                    const h = parsedResults[dir] || {};
                    formattedHands[dir] = `${formatSuitForPbn(h.S)}.${formatSuitForPbn(h.H)}.${formatSuitForPbn(h.D)}.${formatSuitForPbn(h.C)}`;
                }

                const pbnText = buildPbnString(boardNo, formattedHands.N, formattedHands.E, formattedHands.S, formattedHands.W);
                document.getElementById('pbnOutput').value = pbnText;
                
                renderHumanReadableHands(parsedResults);

                resultPanel.style.display = 'block';
                status.innerText = "✅ İşlem Başarıyla Tamamlandı!";

            } catch (err) {
                console.error(err);
                status.innerText = "❌ Hata Oluştu:\n" + (err.message || err.toString());
            } finally {
                btn.disabled = false;
            }
        }

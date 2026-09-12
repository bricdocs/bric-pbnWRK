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

// ============================================================
// cropscript.js - Entegre Kadraj ve Yön Yönetim Modülü (v2.1)
// ============================================================

const dirNames = ['N', 'E', 'S', 'W'];
const dirLabels = { N: 'KUZEY (N)', E: 'DOĞU (E)', S: 'GÜNEY (S)', W: 'BATI (W)' };
const dirFileSuffix = { N: 'NORTH', E: 'EAST', S: 'SOUTH', W: 'WEST' };

let loadedImage = null;
let activeNorthIndex = null;
const boxCanvases = [null, null, null, null];
const boxAssignedDirs = [null, null, null, null];

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
            loadedImage = img;
            document.getElementById('controlsCard').style.display = 'block';
            document.getElementById('tableGrid').style.display = 'flex';
            document.getElementById('statusBanner').style.display = 'block';
            updateCrops();
            resetDirections();
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

function updateCrops() {
    if (!loadedImage) return;

    const topPct = parseInt(document.getElementById('sliderTop').value) / 100;
    const bottomPct = parseInt(document.getElementById('sliderBottom').value) / 100;
    const leftPct = parseInt(document.getElementById('sliderLeft').value) / 100;
    const rightPct = parseInt(document.getElementById('sliderRight').value) / 100;

    document.getElementById('valTop').innerText = Math.round(topPct * 100) + '%';
    document.getElementById('valBottom').innerText = Math.round(bottomPct * 100) + '%';
    document.getElementById('valLeft').innerText = Math.round(leftPct * 100) + '%';
    document.getElementById('valRight').innerText = Math.round(rightPct * 100) + '%';

    const w = loadedImage.naturalWidth;
    const h = loadedImage.naturalHeight;

    // Kendi bölge hesaplamalarınız:
    const cropSpecs = [
        { x: 0, y: 0, width: w, height: topPct * h },                                   // Box 0 (Üst)
        { x: (1 - rightPct) * w, y: 0.18 * h, width: rightPct * w, height: 0.64 * h },  // Box 1 (Sağ)
        { x: 0, y: (1 - bottomPct) * h, width: w, height: bottomPct * h },              // Box 2 (Alt)
        { x: 0, y: 0.18 * h, width: leftPct * w, height: 0.64 * h }                     // Box 3 (Sol)
    ];

    for (let i = 0; i < 4; i++) {
        const spec = cropSpecs[i];
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(spec.width);
        canvas.height = Math.round(spec.height);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            loadedImage,
            Math.round(spec.x), Math.round(spec.y), Math.round(spec.width), Math.round(spec.height),
            0, 0, canvas.width, canvas.height
        );

        boxCanvases[i] = canvas;
        const prevEl = document.getElementById(`cropPrev-${i}`);
        if (prevEl) {
            prevEl.src = canvas.toDataURL('image/jpeg', 0.92);
        }
    }
}

function resetDirections() {
    activeNorthIndex = null;
    for (let i = 0; i < 4; i++) {
        boxAssignedDirs[i] = null;
        const card = document.getElementById(`cropCard-${i}`);
        const badge = document.getElementById(`cropBadge-${i}`);
        
        if (card) card.className = 'crop-card';
        if (badge) {
            badge.className = 'dir-badge unassigned';
            badge.innerText = 'Seçilmedi';
        }
    }
    const btnDL = document.getElementById('btnDownload');
    if (btnDL) btnDL.disabled = true;

    const btnAnalyze = document.getElementById('btn-analyze');
    if (btnAnalyze) btnAnalyze.disabled = true;
    
    const banner = document.getElementById('statusBanner');
    if (banner) {
        banner.className = 'status-banner status-info';
        banner.innerHTML = '⚠️ Lütfen Kuzey (N) olan kutunun altındaki <strong>"🧭 Bu Kutu Kuzey (N)"</strong> butonuna tıklayın.';
    }
}

function setNorthPosition(northIndex) {
    activeNorthIndex = northIndex;

    for (let k = 0; k < 4; k++) {
        const boxIdx = (northIndex + k) % 4;
        const dir = dirNames[k];
        boxAssignedDirs[boxIdx] = dir;

        const card = document.getElementById(`cropCard-${boxIdx}`);
        const badge = document.getElementById(`cropBadge-${boxIdx}`);

        if (card) card.className = boxIdx === northIndex ? 'crop-card is-north' : 'crop-card is-assigned';
        if (badge) {
            badge.className = `dir-badge badge-${dir}`;
            badge.innerText = dirLabels[dir];
        }
    }

    const btnDL = document.getElementById('btnDownload');
    if (btnDL) btnDL.disabled = false;

    const btnAnalyze = document.getElementById('btn-analyze');
    if (btnAnalyze) btnAnalyze.disabled = false;

    const banner = document.getElementById('statusBanner');
    if (banner) {
        banner.className = 'status-banner status-success';
        banner.innerHTML = '✅ Kuzey belirlendi! Tüm yönler saat yönünde (N → E → S → W) atandı. Analiz edebilir veya indirebilirsiniz.';
    }
}

async function downloadAllCrops() {
    if (activeNorthIndex === null) return;

    const downloadBtn = document.getElementById('btnDownload');
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerText = '⏳ Fotoğraflar İndiriliyor...';
    }

    for (let i = 0; i < 4; i++) {
        const canvas = boxCanvases[i];
        const dir = boxAssignedDirs[i];
        if (!canvas || !dir) continue;

        const fileName = `bridge_crop_${dirFileSuffix[dir]}.jpg`;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.innerText = '⬇️ 4 Bölgeyi de İndir (Tüm Yönler)';
    }
}

// ============================================================
// SCRIPT1.JS İLE Gemini ANALİZİ İÇİN KÖPRÜ FONKSİYON
// ============================================================
function getCroppedImagesPayload() {
    if (activeNorthIndex === null) return [];
    
    const payload = [];
    const targetDirs = ['N', 'E', 'S', 'W'];

    for (let dir of targetDirs) {
        const boxIdx = boxAssignedDirs.indexOf(dir);
        if (boxIdx !== -1 && boxCanvases[boxIdx]) {
            payload.push(boxCanvases[boxIdx].toDataURL('image/jpeg', 0.92));
        }
    }

    return payload;
}

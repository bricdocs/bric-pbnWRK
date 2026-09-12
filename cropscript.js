// ============================================================
// cropscript.js - Entegre Kadraj ve Yön Yönetim Modülü (v2.1)
// ============================================================

let loadedImage = null;
let currentNorthRegion = null;
const regionDirections = {}; // Örn: { 1: 'N', 2: 'E', 3: 'S', 4: 'W' }

document.addEventListener("DOMContentLoaded", () => {
    initCropControls();
});

function initCropControls() {
    const fileInput = document.getElementById("board-image-input");
    if (!fileInput) return;

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                loadedImage = img;
                document.getElementById("crop-controls-panel").style.display = "block";
                document.getElementById("crop-grid-container").style.display = "block";
                updateAllCrops();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Slider Dinleyicileri
    const sliders = ["offsetY", "offsetX", "scale", "boxSize"];
    sliders.forEach(id => {
        const slider = document.getElementById(`slider-${id}`);
        const badge = document.getElementById(`val-${id}`);
        if (slider) {
            slider.addEventListener("input", () => {
                if (badge) {
                    const unit = id === "scale" ? "x" : "px";
                    badge.textContent = slider.value + unit;
                }
                updateAllCrops();
            });
        }
    });
}

function updateAllCrops() {
    if (!loadedImage) return;

    const offsetY = parseInt(document.getElementById("slider-offsetY").value) || 0;
    const offsetX = parseInt(document.getElementById("slider-offsetX").value) || 0;
    const scale = parseFloat(document.getElementById("slider-scale").value) || 1.0;
    const boxSize = parseInt(document.getElementById("slider-boxSize").value) || 280;

    const imgW = loadedImage.naturalWidth;
    const imgH = loadedImage.naturalHeight;
    const centerX = (imgW / 2) + offsetX;
    const centerY = (imgH / 2) + offsetY;

    const scaledBoxSize = boxSize * scale;

    // 4 Bölgenin Merkez Koordinatları (1=Üst, 2=Sağ, 3=Alt, 4=Sol)
    const centers = {
        1: { x: centerX, y: centerY - scaledBoxSize * 1.1 },
        2: { x: centerX + scaledBoxSize * 1.1, y: centerY },
        3: { x: centerX, y: centerY + scaledBoxSize * 1.1 },
        4: { x: centerX - scaledBoxSize * 1.1, y: centerY }
    };

    for (let i = 1; i <= 4; i++) {
        cropRegionToCanvas(i, centers[i].x, centers[i].y, scaledBoxSize);
    }
}

function cropRegionToCanvas(regionId, cx, cy, boxSize) {
    const canvas = document.getElementById(`canvas-region-${regionId}`);
    if (!canvas || !loadedImage) return;

    const ctx = canvas.getContext("2d");
    canvas.width = boxSize;
    canvas.height = boxSize;

    const sx = cx - boxSize / 2;
    const sy = cy - boxSize / 2;

    ctx.clearRect(0, 0, boxSize, boxSize);
    ctx.drawImage(
        loadedImage,
        sx, sy, boxSize, boxSize,
        0, 0, boxSize, boxSize
    );
}

// 🧭 Kuzey Yönü Atama Mantığı (Saat Yönü Dönüşü)
function setNorthRegion(northRegionId) {
    currentNorthRegion = northRegionId;
    const dirs = ['N', 'E', 'S', 'W'];
    const badgeClasses = {
        'N': 'badge-N',
        'E': 'badge-E',
        'S': 'badge-S',
        'W': 'badge-W'
    };

    for (let r = 1; r <= 4; r++) {
        const dirIdx = (r - northRegionId + 4) % 4;
        const dir = dirs[dirIdx];
        regionDirections[r] = dir;

        const cardEl = document.getElementById(`card-region-${r}`);
        const badgeEl = document.getElementById(`badge-region-${r}`);

        if (badgeEl) {
            badgeEl.className = `dir-badge ${badgeClasses[dir]}`;
            badgeEl.textContent = `Yön: ${dir}`;
        }

        if (cardEl) {
            cardEl.className = `crop-card ${dir === 'N' ? 'is-north' : 'is-assigned'}`;
        }
    }

    const btnAnalyze = document.getElementById("btn-analyze");
    if (btnAnalyze) {
        btnAnalyze.disabled = false;
    }
}

// 📦 Gemini API için Kırpılmış Görselleri [N, E, S, W] Sırasıyla Dönen Fonksiyon
function getCroppedImagesPayload() {
    if (!currentNorthRegion) return [];

    const payload = [];
    const dirs = ['N', 'E', 'S', 'W'];

    dirs.forEach(targetDir => {
        const regionId = Object.keys(regionDirections).find(r => regionDirections[r] === targetDir);
        if (regionId) {
            const canvas = document.getElementById(`canvas-region-${regionId}`);
            if (canvas) {
                payload.push(canvas.toDataURL("image/jpeg", 0.85));
            }
        }
    });

    return payload;
}

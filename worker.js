/**
 * Vantage HMI Auditor - Feature Extraction Web Worker (worker.js)
 * Offloads deterministic feature extraction algorithms (Section 10)
 * to a background thread for fast, non-blocking single & batch analysis.
 */

self.onmessage = function (e) {
  const { id, imageData, width, height } = e.data;
  try {
    const result = extractFeaturesWorker(imageData, width, height);
    self.postMessage({ id, success: true, features: result });
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};

function extractFeaturesWorker(imageData, width, height) {
  const data = imageData.data;
  const totalPixels = width * height;

  const THRESHOLDS = {
    maxDistinctColors: 6,
    maxAlarmIndicators: 4,
    maxInfoDensity: 0.35,
    minContrastRatio: 4.5,
    maxColorEntropy: 3.8,
    maxAlarmDensity: 0.08
  };

  const WEIGHTS = { ids: 0.25, ad: 0.30, ce: 0.25, cr: 0.20 };
  const RISK_MAX = 1.0;

  const colorBuckets = {};
  let alarmPixels = 0;
  let edgePixels = 0;
  let minCR = Infinity;
  const gridSize = 8;
  const gridCells = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const qr = Math.floor(r / 16), qg = Math.floor(g / 16), qb = Math.floor(b / 16);
      const key = `${qr},${qg},${qb}`;
      colorBuckets[key] = (colorBuckets[key] || 0) + 1;

      // Alarm color heuristic (red/yellow dominant pixels)
      if ((r > 180 && g < 100 && b < 100) || (r > 200 && g > 150 && b < 80)) alarmPixels++;

      // Edge detection (horizontal gradient)
      if (x > 0) {
        const pi = (y * width + (x-1)) * 4;
        const diff = Math.abs(r - data[pi]) + Math.abs(g - data[pi+1]) + Math.abs(b - data[pi+2]);
        if (diff > 60) edgePixels++;
      }
    }
  }

  // Color Entropy
  let colorEntropy = 0;
  const proportions = Object.values(colorBuckets).map(c => c / totalPixels);
  for (const p of proportions) {
    if (p > 0) colorEntropy -= p * Math.log2(p);
  }

  const distinctColors = Object.keys(colorBuckets).filter(k => colorBuckets[k] / totalPixels > 0.005).length;
  const alarmDensity = alarmPixels / totalPixels;
  const ids = edgePixels / totalPixels;

  // Grid contrast sampling & density
  const cellW = width / gridSize;
  const cellH = height / gridSize;
  const cellArea = cellW * cellH;

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let cellEdge = 0;
      let cellAlarm = 0;
      let maxL = -Infinity;
      let minL = Infinity;
      const startX = Math.floor(gx * cellW);
      const startY = Math.floor(gy * cellH);
      const endX = Math.floor((gx + 1) * cellW);
      const endY = Math.floor((gy + 1) * cellH);

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const idx = (py * width + px) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2];
          const lum = relLuminance(r, g, b);
          if (lum > maxL) maxL = lum;
          if (lum < minL) minL = lum;

          if ((r > 180 && g < 100 && b < 100) || (r > 200 && g > 150 && b < 80)) cellAlarm++;
          if (px > startX) {
            const pi = (py * width + (px - 1)) * 4;
            if (Math.abs(r - data[pi]) + Math.abs(g - data[pi+1]) + Math.abs(b - data[pi+2]) > 60) cellEdge++;
          }
        }
      }

      const cr = contrastRatio(maxL, minL);
      // Detail filter: Only evaluate contrast ratio for cells containing significant text/indicator/edge details
      const hasDetail = (maxL - minL) > 0.20 && cellEdge > 8;

      if (hasDetail && cr < minCR) {
        minCR = cr;
      }

      gridCells.push({
        cr: +cr.toFixed(1),
        hasDetail,
        edgeRatio: cellEdge / cellArea,
        alarmRatio: cellAlarm / cellArea,
        x: (gx / gridSize) * 100,
        y: (gy / gridSize) * 100
      });
    }
  }
  if (!isFinite(minCR) || minCR === Infinity) minCR = 21;

  // Risk Score
  const normIDS = Math.min(ids / THRESHOLDS.maxInfoDensity, 1);
  const normAD = Math.min(alarmDensity / THRESHOLDS.maxAlarmDensity, 1);
  const normCE = Math.min(colorEntropy / THRESHOLDS.maxColorEntropy, 1);
  const normCRInv = Math.min((1 / minCR) / (1 / THRESHOLDS.minContrastRatio), 1);

  const risk = WEIGHTS.ids * normIDS + WEIGHTS.ad * normAD + WEIGHTS.ce * normCE + WEIGHTS.cr * normCRInv;
  const riskScore = Math.round(Math.min(risk / RISK_MAX, 1) * 100);
  const complianceScore = Math.round(Math.max(0, Math.min(100, 100 * (1 - risk / RISK_MAX))));
  const cognitiveLoad = Math.round(0.35 * normIDS * 100 + 0.35 * normAD * 100 + 0.15 * normCE * 100 + 0.15 * normCRInv * 100);

  return {
    ids: +ids.toFixed(3),
    alarmDensity: +alarmDensity.toFixed(4),
    colorEntropy: +colorEntropy.toFixed(2),
    distinctColors,
    minContrastRatio: +minCR.toFixed(1),
    riskScore,
    complianceScore,
    cognitiveLoad,
    rawRisk: +risk.toFixed(3),
    gridCells
  };
}

function relLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

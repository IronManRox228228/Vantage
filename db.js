/**
 * Vantage HMI Auditor - Unified IndexedDB Database Layer (db.js)
 * Manages Plants, Screens, Analysis Runs, and Batch Audits.
 */

const DB_NAME = 'SignalNoise_HMI_DB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store: Plants
      if (!db.objectStoreNames.contains('plants')) {
        const plantStore = db.createObjectStore('plants', { keyPath: 'id' });
        plantStore.createIndex('name', 'name', { unique: false });
        plantStore.createIndex('industry_type', 'industry_type', { unique: false });
      }

      // Store: Screens
      if (!db.objectStoreNames.contains('screens')) {
        const screenStore = db.createObjectStore('screens', { keyPath: 'id' });
        screenStore.createIndex('plant_id', 'plant_id', { unique: false });
        screenStore.createIndex('name', 'name', { unique: false });
        screenStore.createIndex('screen_type', 'screen_type', { unique: false });
      }

      // Store: Analysis Runs
      if (!db.objectStoreNames.contains('analysis_runs')) {
        const runStore = db.createObjectStore('analysis_runs', { keyPath: 'id' });
        runStore.createIndex('screen_id', 'screen_id', { unique: false });
        runStore.createIndex('plant_id', 'plant_id', { unique: false });
        runStore.createIndex('timestamp', 'timestamp', { unique: false });
        runStore.createIndex('risk_score', 'risk_score', { unique: false });
        runStore.createIndex('image_hash', 'image_hash', { unique: false });
      }

      // Store: Batch Audits
      if (!db.objectStoreNames.contains('batch_runs')) {
        const batchStore = db.createObjectStore('batch_runs', { keyPath: 'id' });
        batchStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// --- Helper Utilities ---

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// Compute simple perceptual hash (pHash 8x8 average hash) for image comparison
async function computeImageHash(imageElementOrCanvas) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElementOrCanvas, 0, 0, 8, 8);
    const imgData = ctx.getImageData(0, 0, 8, 8).data;
    
    let sum = 0;
    const grays = [];
    for (let i = 0; i < imgData.length; i += 4) {
      const gray = 0.299 * imgData[i] + 0.587 * imgData[i+1] + 0.114 * imgData[i+2];
      grays.push(gray);
      sum += gray;
    }
    const avg = sum / 64;
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += grays[i] >= avg ? '1' : '0';
    }
    return hash;
  } catch (e) {
    return '0'.repeat(64);
  }
}

// Hamming distance between two pHashes
function hashDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

// --- Plant Operations ---

async function getAllPlants() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('plants', 'readonly');
    const store = tx.objectStore('plants');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function addPlant(plant) {
  const db = await openDB();
  const plantObj = {
    id: plant.id || generateId('plant'),
    name: plant.name || 'Unnamed Plant',
    location: plant.location || 'Site A',
    industry_type: plant.industry_type || 'General Industrial',
    created_at: plant.created_at || Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('plants', 'readwrite');
    const store = tx.objectStore('plants');
    const request = store.put(plantObj);
    request.onsuccess = () => resolve(plantObj);
    request.onerror = () => reject(request.error);
  });
}

// --- Screen Operations ---

async function getScreensByPlant(plantId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('screens', 'readonly');
    const store = tx.objectStore('screens');
    const index = store.index('plant_id');
    const request = index.getAll(plantId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getAllScreens() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('screens', 'readonly');
    const store = tx.objectStore('screens');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function addScreen(screen) {
  const db = await openDB();
  const screenObj = {
    id: screen.id || generateId('screen'),
    plant_id: screen.plant_id,
    name: screen.name || 'Screen Overview',
    tag: screen.tag || 'SCR-001',
    description: screen.description || '',
    screen_type: screen.screen_type || 'overview', // 'overview' | 'unit' | 'detail' | 'alarm'
    created_at: screen.created_at || Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('screens', 'readwrite');
    const store = tx.objectStore('screens');
    const request = store.put(screenObj);
    request.onsuccess = () => resolve(screenObj);
    request.onerror = () => reject(request.error);
  });
}

// --- Analysis Run Operations ---

async function saveAnalysisRun(runData) {
  const db = await openDB();
  const runObj = {
    id: runData.id || generateId('run'),
    plant_id: runData.plant_id,
    screen_id: runData.screen_id,
    timestamp: runData.timestamp || Date.now(),
    image_hash: runData.image_hash || '',
    risk_score: runData.risk_score,
    compliance_score: runData.compliance_score,
    cognitive_load: runData.cognitive_load,
    metrics_snapshot: runData.metrics_snapshot || {},
    issues_count_by_severity: runData.issues_count_by_severity || { high: 0, medium: 0, low: 0 },
    issues_count_by_category: runData.issues_count_by_category || {},
    issues: runData.issues || [],
    detected_elements: runData.detected_elements || {},
    ai_model_version: runData.ai_model_version || 'Gemini 3.1 Flash Lite',
    thumbnail: runData.thumbnail || '' // optional data URL thumbnail
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('analysis_runs', 'readwrite');
    const store = tx.objectStore('analysis_runs');
    const request = store.put(runObj);
    request.onsuccess = () => resolve(runObj);
    request.onerror = () => reject(request.error);
  });
}

async function getAllAnalysisRuns() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('analysis_runs', 'readonly');
    const store = tx.objectStore('analysis_runs');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getRunsByScreen(screenId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('analysis_runs', 'readonly');
    const store = tx.objectStore('analysis_runs');
    const index = store.index('screen_id');
    const request = index.getAll(screenId);
    request.onsuccess = () => {
      const sorted = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteAnalysisRun(runId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('analysis_runs', 'readwrite');
    const store = tx.objectStore('analysis_runs');
    const request = store.delete(runId);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// --- Batch Run Operations ---

async function saveBatchRun(batchData) {
  const db = await openDB();
  const batchObj = {
    id: batchData.id || generateId('batch'),
    name: batchData.name || `Batch Audit ${new Date().toLocaleDateString()}`,
    timestamp: batchData.timestamp || Date.now(),
    total_screens: batchData.total_screens || 0,
    avg_risk: batchData.avg_risk || 0,
    avg_compliance: batchData.avg_compliance || 0,
    screen_results: batchData.screen_results || []
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('batch_runs', 'readwrite');
    const store = tx.objectStore('batch_runs');
    const request = store.put(batchObj);
    request.onsuccess = () => resolve(batchObj);
    request.onerror = () => reject(request.error);
  });
}

// --- Demo Data Seeder ---

async function seedDemoHistoricalData() {
  const plants = [
    { id: 'plant_refinery_01', name: 'Jamnagar Refinery Unit 4', location: 'Gujarat, IN', industry_type: 'Oil & Gas' },
    { id: 'plant_power_02', name: 'NTPC Thermal Power Station', location: 'Singrauli, IN', industry_type: 'Power Generation' },
    { id: 'plant_chem_03', name: 'Dahej Specialty Chemicals', location: 'Bharuch, IN', industry_type: 'Chemical Processing' }
  ];

  for (const p of plants) {
    await addPlant(p);
  }

  const screens = [
    { id: 'scr_ref_01', plant_id: 'plant_refinery_01', name: 'Crude Distillation Unit (CDU-1)', tag: 'HMI-CDU-101', screen_type: 'overview' },
    { id: 'scr_ref_02', plant_id: 'plant_refinery_01', name: 'FCCU Reactor Control Panel', tag: 'HMI-FCC-204', screen_type: 'unit' },
    { id: 'scr_power_01', plant_id: 'plant_power_02', name: 'Boiler 3 Master Control', tag: 'HMI-BLR-301', screen_type: 'overview' },
    { id: 'scr_power_02', plant_id: 'plant_power_02', name: 'Turbine Generator Trip Alarms', tag: 'HMI-TURB-102', screen_type: 'alarm' },
    { id: 'scr_chem_01', plant_id: 'plant_chem_03', name: 'Polymerization Reactor Feed', tag: 'HMI-POLY-501', screen_type: 'detail' }
  ];

  for (const s of screens) {
    await addScreen(s);
  }

  const now = Date.now();
  const day = 86400 * 1000;

  // Generate 6 months of historical audit points with improving trend after redesigns
  const demoRuns = [
    // CDU-1 trend over 90 days
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 90, risk: 78, comp: 22, cog: 84, high: 4, med: 5, low: 3 },
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 60, risk: 65, comp: 35, cog: 72, high: 3, med: 4, low: 2 },
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 30, risk: 42, comp: 58, cog: 51, high: 1, med: 3, low: 3 },
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 5,  risk: 24, comp: 76, cog: 32, high: 0, med: 2, low: 2 },

    // FCCU trend
    { screen_id: 'scr_ref_02', plant_id: 'plant_refinery_01', offsetDays: 75, risk: 85, comp: 15, cog: 91, high: 5, med: 6, low: 4 },
    { screen_id: 'scr_ref_02', plant_id: 'plant_refinery_01', offsetDays: 45, risk: 54, comp: 46, cog: 60, high: 2, med: 3, low: 3 },
    { screen_id: 'scr_ref_02', plant_id: 'plant_refinery_01', offsetDays: 10, risk: 31, comp: 69, cog: 38, high: 0, med: 3, low: 1 },

    // Power station boiler trend
    { screen_id: 'scr_power_01', plant_id: 'plant_power_02', offsetDays: 80, risk: 62, comp: 38, cog: 68, high: 2, med: 4, low: 2 },
    { screen_id: 'scr_power_01', plant_id: 'plant_power_02', offsetDays: 20, risk: 28, comp: 72, cog: 35, high: 0, med: 2, low: 3 },

    // Alarm screen trend
    { screen_id: 'scr_power_02', plant_id: 'plant_power_02', offsetDays: 40, risk: 92, comp: 8,  cog: 95, high: 7, med: 4, low: 1 },
    { screen_id: 'scr_power_02', plant_id: 'plant_power_02', offsetDays: 12, risk: 48, comp: 52, cog: 55, high: 1, med: 4, low: 2 },

    // Polymerization detail trend
    { screen_id: 'scr_chem_01', plant_id: 'plant_chem_03', offsetDays: 50, risk: 45, comp: 55, cog: 48, high: 1, med: 3, low: 2 },
    { screen_id: 'scr_chem_01', plant_id: 'plant_chem_03', offsetDays: 2,  risk: 18, comp: 82, cog: 25, high: 0, med: 1, low: 2 }
  ];

  for (const dr of demoRuns) {
    const runTimestamp = now - (dr.offsetDays * day);
    await saveAnalysisRun({
      id: generateId('run_demo'),
      screen_id: dr.screen_id,
      plant_id: dr.plant_id,
      timestamp: runTimestamp,
      image_hash: '1100110011001100110011001100110011001100110011001100110011001100',
      risk_score: dr.risk,
      compliance_score: dr.comp,
      cognitive_load: dr.cog,
      metrics_snapshot: {
        ids: +(0.20 + (dr.risk / 300)).toFixed(2),
        alarmDensity: +(0.02 + (dr.risk / 1000)).toFixed(3),
        colorEntropy: +(2.0 + (dr.risk / 50)).toFixed(2),
        distinctColors: Math.max(3, Math.round(dr.risk / 10)),
        minContrastRatio: +(8 - (dr.risk / 20)).toFixed(1)
      },
      issues_count_by_severity: { high: dr.high, medium: dr.med, low: dr.low },
      issues_count_by_category: {
        'color-overuse': Math.round(dr.high * 0.6 + dr.med * 0.4),
        'alarm-clutter': Math.round(dr.high * 0.4 + dr.med * 0.3),
        'information-density': Math.round(dr.med * 0.5 + dr.low * 0.5),
        'navigation-clutter': Math.round(dr.low * 0.5),
        'contrast-legibility': Math.round(dr.high * 0.2 + dr.med * 0.2)
      },
      issues: [
        { x: 10, y: 15, w: 30, h: 20, category: 'color-overuse', severity: dr.high > 0 ? 'high' : 'medium', issue: 'Excessive vibrant colors used for non-alarm elements.', recommendation: 'Adopt gray-scale normal ISA-101 theme.', standard_ref: 'ISA-101 §5' },
        { x: 50, y: 40, w: 40, h: 30, category: 'information-density', severity: dr.med > 0 ? 'medium' : 'low', issue: 'High edge pixel ratio creates visual noise.', recommendation: 'Simplify boundary outlines and expand white space.', standard_ref: 'NUREG-0700 §8' }
      ],
      ai_model_version: 'Gemini 3.1 Flash Lite (Audit Baseline)'
    });
  }

  return true;
}

// Expose on window
window.HMI_DB = {
  openDB,
  generateId,
  computeImageHash,
  hashDistance,
  getAllPlants,
  addPlant,
  getScreensByPlant,
  getAllScreens,
  addScreen,
  saveAnalysisRun,
  getAllAnalysisRuns,
  getRunsByScreen,
  deleteAnalysisRun,
  saveBatchRun,
  seedDemoHistoricalData
};

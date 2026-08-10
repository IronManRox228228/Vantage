import { supabase, Plant, Screen, AnalysisRun, BatchRun } from './supabase';

const LOCAL_STORAGE_KEY = 'vantage_offline_db_v1';

function getLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { plants: [], screens: [], runs: [], batchRuns: [] };
    return JSON.parse(raw);
  } catch (e) {
    return { plants: [], screens: [], runs: [], batchRuns: [] };
  }
}

function saveLocalData(data: any) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Generate unique ID with prefix
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Perceptual Hash (8x8 average hash)
export async function computeImageHash(imageElementOrCanvas: HTMLImageElement | HTMLCanvasElement): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '0'.repeat(64);

    ctx.drawImage(imageElementOrCanvas, 0, 0, 8, 8);
    const imgData = ctx.getImageData(0, 0, 8, 8).data;

    let sum = 0;
    const grays: number[] = [];
    for (let i = 0; i < imgData.length; i += 4) {
      const gray = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
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
export function hashDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

// --- Plant Operations ---

export async function getAllPlants(): Promise<Plant[]> {
  try {
    const { data, error } = await supabase.from('plants').select('*').order('name');
    if (!error && data) return data;
  } catch (e) {
    // Offline fallback
  }
  return getLocalData().plants || [];
}

export async function addPlant(plant: Partial<Plant>): Promise<Plant> {
  const newPlant: Plant = {
    id: plant.id || generateId('plant'),
    name: plant.name || 'Unnamed Plant',
    location: plant.location || 'Site A',
    industry_type: plant.industry_type || 'General Industrial',
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase.from('plants').insert(newPlant).select().single();
    if (!error && data) return data;
  } catch (e) {
    // Fall through to local fallback
  }

  const local = getLocalData();
  local.plants.push(newPlant);
  saveLocalData(local);
  return newPlant;
}

// --- Screen Operations ---

export async function getAllScreens(): Promise<Screen[]> {
  try {
    const { data, error } = await supabase.from('screens').select('*').order('name');
    if (!error && data) return data;
  } catch (e) {
    // Offline fallback
  }
  return getLocalData().screens || [];
}

export async function getScreensByPlant(plantId: string): Promise<Screen[]> {
  try {
    const { data, error } = await supabase.from('screens').select('*').eq('plant_id', plantId).order('name');
    if (!error && data) return data;
  } catch (e) {
    // Offline fallback
  }
  const local = getLocalData();
  return (local.screens || []).filter((s: Screen) => s.plant_id === plantId);
}

export async function addScreen(screen: Partial<Screen>): Promise<Screen> {
  const newScreen: Screen = {
    id: screen.id || generateId('screen'),
    plant_id: screen.plant_id || '',
    name: screen.name || 'Screen Overview',
    tag: screen.tag || 'SCR-001',
    description: screen.description || '',
    screen_type: screen.screen_type || 'overview',
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase.from('screens').insert(newScreen).select().single();
    if (!error && data) return data;
  } catch (e) {
    // Fall through
  }

  const local = getLocalData();
  local.screens.push(newScreen);
  saveLocalData(local);
  return newScreen;
}

// --- Analysis Run Operations ---

export async function saveAnalysisRun(runData: Partial<AnalysisRun>): Promise<AnalysisRun> {
  const newRun: AnalysisRun = {
    id: runData.id || generateId('run'),
    plant_id: runData.plant_id,
    screen_id: runData.screen_id,
    timestamp: runData.timestamp || Date.now(),
    image_hash: runData.image_hash || '',
    risk_score: runData.risk_score || 0,
    compliance_score: runData.compliance_score || 100,
    cognitive_load: runData.cognitive_load || 0,
    metrics_snapshot: runData.metrics_snapshot || {},
    issues_count_by_severity: runData.issues_count_by_severity || { high: 0, medium: 0, low: 0 },
    issues_count_by_category: runData.issues_count_by_category || {},
    issues: runData.issues || [],
    detected_elements: runData.detected_elements || {},
    ai_model_version: runData.ai_model_version || 'Gemini 3.1 Flash Lite',
    thumbnail_url: runData.thumbnail_url || ''
  };

  try {
    const { data, error } = await supabase.from('analysis_runs').insert(newRun).select().single();
    if (!error && data) return data;
  } catch (e) {
    // Fall through
  }

  const local = getLocalData();
  local.runs.push(newRun);
  saveLocalData(local);
  return newRun;
}

export async function getAllAnalysisRuns(): Promise<AnalysisRun[]> {
  try {
    const { data, error } = await supabase.from('analysis_runs').select('*').order('timestamp', { ascending: false });
    if (!error && data) return data;
  } catch (e) {
    // Offline fallback
  }
  const local = getLocalData();
  return (local.runs || []).sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp));
}

export async function getRunsByScreen(screenId: string): Promise<AnalysisRun[]> {
  try {
    const { data, error } = await supabase.from('analysis_runs').select('*').eq('screen_id', screenId).order('timestamp', { ascending: true });
    if (!error && data) return data;
  } catch (e) {
    // Offline fallback
  }
  const local = getLocalData();
  return (local.runs || [])
    .filter((r: AnalysisRun) => r.screen_id === screenId)
    .sort((a: any, b: any) => Number(a.timestamp) - Number(b.timestamp));
}

export async function deleteAnalysisRun(runId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('analysis_runs').delete().eq('id', runId);
    if (!error) return true;
  } catch (e) {
    // Fall through
  }

  const local = getLocalData();
  local.runs = (local.runs || []).filter((r: AnalysisRun) => r.id !== runId);
  saveLocalData(local);
  return true;
}

// --- Batch Run Operations ---

export async function saveBatchRun(batchData: Partial<BatchRun>): Promise<BatchRun> {
  const newBatch: BatchRun = {
    id: batchData.id || generateId('batch'),
    name: batchData.name || `Batch Audit ${new Date().toLocaleDateString()}`,
    timestamp: batchData.timestamp || Date.now(),
    total_screens: batchData.total_screens || 0,
    avg_risk: batchData.avg_risk || 0,
    avg_compliance: batchData.avg_compliance || 0,
    screen_results: batchData.screen_results || []
  };

  try {
    const { data, error } = await supabase.from('batch_runs').insert(newBatch).select().single();
    if (!error && data) return data;
  } catch (e) {
    // Fall through
  }

  const local = getLocalData();
  local.batchRuns.push(newBatch);
  saveLocalData(local);
  return newBatch;
}

// --- Demo Data Seeder ---

export async function seedDemoData(): Promise<boolean> {
  const plants = [
    { id: 'plant_refinery_01', name: 'Jamnagar Refinery Unit 4', location: 'Gujarat, IN', industry_type: 'Oil & Gas' },
    { id: 'plant_power_02', name: 'NTPC Thermal Power Station', location: 'Singrauli, IN', industry_type: 'Power Generation' },
    { id: 'plant_chem_03', name: 'Dahej Specialty Chemicals', location: 'Bharuch, IN', industry_type: 'Chemical Processing' }
  ];

  for (const p of plants) {
    await addPlant(p);
  }

  const screens = [
    { id: 'scr_ref_01', plant_id: 'plant_refinery_01', name: 'Crude Distillation Unit (CDU-1)', tag: 'HMI-CDU-101', screen_type: 'overview' as const },
    { id: 'scr_ref_02', plant_id: 'plant_refinery_01', name: 'FCCU Reactor Control Panel', tag: 'HMI-FCC-204', screen_type: 'unit' as const },
    { id: 'scr_power_01', plant_id: 'plant_power_02', name: 'Boiler 3 Master Control', tag: 'HMI-BLR-301', screen_type: 'overview' as const },
    { id: 'scr_power_02', plant_id: 'plant_power_02', name: 'Turbine Generator Trip Alarms', tag: 'HMI-TURB-102', screen_type: 'alarm' as const },
    { id: 'scr_chem_01', plant_id: 'plant_chem_03', name: 'Polymerization Reactor Feed', tag: 'HMI-POLY-501', screen_type: 'detail' as const }
  ];

  for (const s of screens) {
    await addScreen(s);
  }

  const now = Date.now();
  const day = 86400 * 1000;

  const demoRuns = [
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 90, risk: 78, comp: 22, cog: 84, high: 4, med: 5, low: 3 },
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 60, risk: 65, comp: 35, cog: 72, high: 3, med: 4, low: 2 },
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 30, risk: 42, comp: 58, cog: 51, high: 1, med: 3, low: 3 },
    { screen_id: 'scr_ref_01', plant_id: 'plant_refinery_01', offsetDays: 5,  risk: 24, comp: 76, cog: 32, high: 0, med: 2, low: 2 },

    { screen_id: 'scr_ref_02', plant_id: 'plant_refinery_01', offsetDays: 75, risk: 85, comp: 15, cog: 91, high: 5, med: 6, low: 4 },
    { screen_id: 'scr_ref_02', plant_id: 'plant_refinery_01', offsetDays: 45, risk: 54, comp: 46, cog: 60, high: 2, med: 3, low: 3 },
    { screen_id: 'scr_ref_02', plant_id: 'plant_refinery_01', offsetDays: 10, risk: 31, comp: 69, cog: 38, high: 0, med: 3, low: 1 },

    { screen_id: 'scr_power_01', plant_id: 'plant_power_02', offsetDays: 80, risk: 62, comp: 38, cog: 68, high: 2, med: 4, low: 2 },
    { screen_id: 'scr_power_01', plant_id: 'plant_power_02', offsetDays: 20, risk: 28, comp: 72, cog: 35, high: 0, med: 2, low: 3 },

    { screen_id: 'scr_power_02', plant_id: 'plant_power_02', offsetDays: 40, risk: 92, comp: 8,  cog: 95, high: 7, med: 4, low: 1 },
    { screen_id: 'scr_power_02', plant_id: 'plant_power_02', offsetDays: 12, risk: 48, comp: 52, cog: 55, high: 1, med: 4, low: 2 },

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

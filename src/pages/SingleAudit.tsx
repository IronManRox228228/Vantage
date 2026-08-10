import React, { useState, useEffect } from 'react';
import { Upload, Play, Save, Download, AlertTriangle, ShieldCheck, Cpu, Image as ImageIcon, Eye } from 'lucide-react';
import { extractHmiFeatures, ExtractedFeatures } from '../lib/workerExtractor';
import { saveAnalysisRun, computeImageHash, getAllPlants, getScreensByPlant } from '../lib/dbService';
import { HmiCanvas } from '../components/HmiCanvas';
import { Plant, Screen, AnalysisRun } from '../lib/supabase';

// Check if running inside Tauri
async function invokeTauriCommand<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new Error(`Tauri invoke unavailable: ${e}`);
  }
}

export const SingleAudit: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [features, setFeatures] = useState<ExtractedFeatures | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');

  useEffect(() => {
    async function loadAssets() {
      const p = await getAllPlants();
      setPlants(p);
      if (p.length > 0) {
        setSelectedPlantId(p[0].id);
        const s = await getScreensByPlant(p[0].id);
        setScreens(s);
        if (s.length > 0) setSelectedScreenId(s[0].id);
      }
    }
    loadAssets();
  }, []);

  const handlePlantChange = async (plantId: string) => {
    setSelectedPlantId(plantId);
    const s = await getScreensByPlant(plantId);
    setScreens(s);
    if (s.length > 0) setSelectedScreenId(s[0].id);
    else setSelectedScreenId('');
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageSrc(result);
      setFeatures(null);
      setIssues([]);
      setAiSummary('');
    };
    reader.readAsDataURL(file);
  };

  const runAudit = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);

    try {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((res) => (img.onload = res));

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 1. Run deterministic feature extraction
      const feat = extractHmiFeatures(imageData);
      setFeatures(feat);

      // 2. Call Gemini AI via native Rust command or fallback
      const prompt = `Analyze this HMI screen for ISA-101 and NUREG-0700 compliance.
Return JSON ONLY matching format:
{
  "summary": "Executive summary of safety and ergonomics...",
  "issues": [
    {
      "x": 10, "y": 15, "w": 25, "h": 20,
      "category": "color-overuse",
      "severity": "high",
      "issue": "Excessive vibrant red used for static background element.",
      "recommendation": "Use neutral gray-scale background per ISA-101.",
      "standard_ref": "ISA-101 §5.2"
    }
  ]
}`;

      let aiResponseText = '';
      try {
        // Native Rust IPC command (Zero Key Leakage!)
        const rawResponse = await invokeTauriCommand<string>('analyze_hmi_with_gemini', {
          imageBase64: imageSrc,
          prompt,
        });
        const parsed = JSON.parse(rawResponse);
        const textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiJson = JSON.parse(jsonMatch[0]);
          setAiSummary(aiJson.summary || '');
          setIssues(aiJson.issues || []);
        } else {
          aiResponseText = textContent;
        }
      } catch (err) {
        console.warn('Native Rust Gemini API call failed or in browser mode, generating rule-based audit results.');
        // Rule-based fallback based on extracted features
        const fallbackIssues: any[] = [];
        if (feat.alarmDensity > 0.05) {
          fallbackIssues.push({
            x: 10, y: 10, w: 40, h: 30,
            category: 'alarm-clutter',
            severity: 'high',
            issue: `Excessive alarm indicator density (${(feat.alarmDensity * 100).toFixed(1)}%).`,
            recommendation: 'Group alarms into high-level priority summaries.',
            standard_ref: 'ISA-101 §7'
          });
        }
        if (feat.colorEntropy > 3.0) {
          fallbackIssues.push({
            x: 50, y: 30, w: 40, h: 35,
            category: 'color-overuse',
            severity: 'medium',
            issue: `High visual color complexity (Entropy: ${feat.colorEntropy}).`,
            recommendation: 'Standardize on muted grayscale backdrop with high-contrast active elements.',
            standard_ref: 'NUREG-0700 §8.4'
          });
        }
        if (feat.minContrastRatio < 4.5) {
          fallbackIssues.push({
            x: 20, y: 60, w: 50, h: 25,
            category: 'contrast-legibility',
            severity: 'high',
            issue: `Low text contrast ratio (${feat.minContrastRatio}:1).`,
            recommendation: 'Increase text/background contrast to minimum 4.5:1 ratio.',
            standard_ref: 'ISA-101 §6.1'
          });
        }
        setIssues(fallbackIssues);
        setAiSummary('Deterministic ISA-101 baseline analysis completed.');
      }
    } catch (e: any) {
      alert(`Audit failed: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveRun = async () => {
    if (!features) return;
    const imgEl = new Image();
    imgEl.src = imageSrc || '';
    await new Promise((res) => (imgEl.onload = res));

    const pHash = await computeImageHash(imgEl);

    const run: Partial<AnalysisRun> = {
      plant_id: selectedPlantId,
      screen_id: selectedScreenId,
      timestamp: Date.now(),
      image_hash: pHash,
      risk_score: features.riskScore,
      compliance_score: features.complianceScore,
      cognitive_load: features.cognitiveLoad,
      metrics_snapshot: {
        ids: features.ids,
        alarmDensity: features.alarmDensity,
        colorEntropy: features.colorEntropy,
        distinctColors: features.distinctColors,
        minContrastRatio: features.minContrastRatio,
      },
      issues_count_by_severity: {
        high: issues.filter((i) => i.severity === 'high').length,
        medium: issues.filter((i) => i.severity === 'medium').length,
        low: issues.filter((i) => i.severity === 'low').length,
      },
      issues,
      ai_model_version: 'Gemini 3.1 Flash Lite (Rust Native)',
    };

    await saveAnalysisRun(run);
    alert('Analysis run successfully saved to database!');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Toolbar */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Upload Screenshot
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </label>

          <button
            className="btn"
            disabled={!imageSrc || isAnalyzing}
            onClick={runAudit}
            style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}
          >
            <Play size={14} /> {isAnalyzing ? 'Auditing Screen...' : 'Run ISA-101 Audit'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '6px' }}>Target Plant:</span>
            <select
              value={selectedPlantId}
              onChange={(e) => handlePlantChange(e.target.value)}
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}
            >
              {plants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '6px' }}>HMI Screen:</span>
            <select
              value={selectedScreenId}
              onChange={(e) => setSelectedScreenId(e.target.value)}
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}
            >
              {screens.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.tag})</option>
              ))}
            </select>
          </div>

          <button className="btn" disabled={!features} onClick={handleSaveRun}>
            <Save size={14} /> Save Audit
          </button>
        </div>
      </div>

      {/* Main Grid: Left Canvas, Right Analysis Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px' }}>
        {/* Left Column: Interactive Canvas */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--amber)' }}>
              <Eye size={16} />
              VISUAL AUDIT CANVAS & ANNOTATIONS
            </h3>
            <HmiCanvas
              imageSrc={imageSrc}
              issues={issues}
              selectedIssueIndex={selectedIssueIndex}
              onSelectIssue={setSelectedIssueIndex}
            />
          </div>

          {/* AI Executive Summary */}
          {aiSummary && (
            <div className="card" style={{ borderLeft: '4px solid var(--teal)' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--teal)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                AI Executive Ergonomics Summary
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '1.6' }}>{aiSummary}</p>
            </div>
          )}
        </div>

        {/* Right Column: Scorecard & Violations Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key Metrics Cards */}
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Risk Score</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: (features?.riskScore || 0) > 50 ? 'var(--red)' : 'var(--teal)' }}>
                {features ? `${features.riskScore}/100` : '--'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Compliance</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: (features?.complianceScore || 0) > 70 ? 'var(--teal)' : 'var(--amber)' }}>
                {features ? `${features.complianceScore}%` : '--'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Cog. Load</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--blue)' }}>
                {features ? `${features.cognitiveLoad}` : '--'}
              </div>
            </div>
          </div>

          {/* Image Metrics */}
          {features && (
            <div className="card">
              <h4 style={{ fontSize: '12px', color: 'var(--amber)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Extracted Image Features
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                <div>Color Entropy: <strong>{features.colorEntropy}</strong></div>
                <div>Distinct Colors: <strong>{features.distinctColors}</strong></div>
                <div>Alarm Pixel Density: <strong>{(features.alarmDensity * 100).toFixed(2)}%</strong></div>
                <div>Min Contrast Ratio: <strong>{features.minContrastRatio}:1</strong></div>
              </div>
            </div>
          )}

          {/* Categorized Violations List */}
          <div className="card" style={{ flex: 1, overflow: 'auto', maxHeight: '500px' }}>
            <h4 style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '12px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
              <span>ISA-101 Violations ({issues.length})</span>
            </h4>

            {issues.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No compliance issues detected or audit not executed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedIssueIndex(idx)}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius)',
                      background: selectedIssueIndex === idx ? 'var(--surface-2)' : 'var(--bg)',
                      border: `1px solid ${selectedIssueIndex === idx ? 'var(--amber)' : 'var(--line)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className={`badge badge-${issue.severity}`}>#{idx + 1} {issue.severity}</span>
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{issue.standard_ref}</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>{issue.issue}</div>
                    <div style={{ fontSize: '11px', color: 'var(--teal)' }}>Rec: {issue.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

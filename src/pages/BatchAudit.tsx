import React, { useState } from 'react';
import { Layers, Upload, Play, Save, CheckCircle, AlertTriangle, BookOpen } from 'lucide-react';
import { extractHmiFeatures } from '../lib/workerExtractor';
import { saveBatchRun } from '../lib/dbService';
import { buildGroundedContextForAudit } from '../lib/ragEngine';

interface BatchItem {
  name: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  riskScore?: number;
  complianceScore?: number;
  issuesCount?: number;
  primaryCitation?: string;
}

export const BatchAudit: React.FC = () => {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchName, setBatchName] = useState(`Batch Audit ${new Date().toLocaleDateString()}`);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const items: BatchItem[] = Array.from(files).map((f) => ({
      name: f.name,
      file: f,
      status: 'pending',
    }));
    setBatchItems(items);
  };

  const runBatchAnalysis = async () => {
    if (batchItems.length === 0) return;
    setIsProcessing(true);

    const updated = [...batchItems];
    for (let i = 0; i < updated.length; i++) {
      updated[i].status = 'processing';
      setBatchItems([...updated]);

      try {
        const item = updated[i];
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((res) => {
          reader.onload = (e) => res(e.target?.result as string);
          reader.readAsDataURL(item.file);
        });

        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => (img.onload = res));

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const feat = extractHmiFeatures(imageData);

          // Retrieve grounded standards for screen
          const { regulations } = buildGroundedContextForAudit(feat);

          updated[i].status = 'done';
          updated[i].riskScore = feat.riskScore;
          updated[i].complianceScore = feat.complianceScore;
          updated[i].issuesCount = feat.alarmDensity > 0.04 ? 3 : feat.colorEntropy > 2.8 ? 2 : 1;
          updated[i].primaryCitation = regulations[0]?.citation || 'ANSI/ISA-101.01-2015 §5.3';
        }
      } catch (e) {
        updated[i].status = 'error';
      }
      setBatchItems([...updated]);
    }
    setIsProcessing(false);
  };

  const totalDone = batchItems.filter((i) => i.status === 'done').length;
  const avgRisk = totalDone > 0
    ? Math.round(batchItems.reduce((acc, curr) => acc + (curr.riskScore || 0), 0) / totalDone)
    : 0;
  const avgCompliance = totalDone > 0
    ? Math.round(batchItems.reduce((acc, curr) => acc + (curr.complianceScore || 0), 0) / totalDone)
    : 0;

  const handleSaveBatch = async () => {
    if (totalDone === 0) return;
    await saveBatchRun({
      name: batchName,
      timestamp: Date.now(),
      total_screens: totalDone,
      avg_risk: avgRisk,
      avg_compliance: avgCompliance,
      screen_results: batchItems.map((b) => ({
        name: b.name,
        risk: b.riskScore,
        compliance: b.complianceScore,
        citation: b.primaryCitation,
      })),
    });
    alert('Batch Audit summary saved successfully with Grounded Citations!');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)' }}>
            <Layers size={18} color="var(--amber)" />
            BATCH HMI AUDITOR (GROUNDED RAG)
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Audit entire plant folders of HMI screens grounded in ANSI/ISA-101.01-2015 and NUREG-0700 Rev. 1
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Select Screenshots
            <input
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </label>

          <button
            className="btn"
            disabled={batchItems.length === 0 || isProcessing}
            onClick={runBatchAnalysis}
            style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}
          >
            <Play size={14} /> {isProcessing ? 'Processing Queue...' : `Run Batch Audit (${batchItems.length})`}
          </button>

          <button className="btn" disabled={totalDone === 0} onClick={handleSaveBatch}>
            <Save size={14} /> Save Batch Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Total Screens</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{batchItems.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Processed</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--teal)' }}>{totalDone} / {batchItems.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Plant Avg Risk</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: avgRisk > 50 ? 'var(--red)' : 'var(--teal)' }}>{avgRisk}/100</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Avg Compliance</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: avgCompliance > 70 ? 'var(--teal)' : 'var(--amber)' }}>{avgCompliance}%</div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--amber)' }}>Batch Audit Queue & Grounded Standards</h3>
        {batchItems.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>
            No HMI screen files selected. Click "Select Screenshots" above to begin batch analysis.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                <th style={{ padding: '8px 12px' }}>#</th>
                <th style={{ padding: '8px 12px' }}>Screen File</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Risk Score</th>
                <th style={{ padding: '8px 12px' }}>Compliance</th>
                <th style={{ padding: '8px 12px' }}>Grounded Standard</th>
              </tr>
            </thead>
            <tbody>
              {batchItems.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 12px' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {item.status === 'pending' && <span style={{ color: 'var(--muted)' }}>Pending</span>}
                    {item.status === 'processing' && <span style={{ color: 'var(--amber)' }}>Processing...</span>}
                    {item.status === 'done' && <span style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Grounded</span>}
                    {item.status === 'error' && <span style={{ color: 'var(--red)' }}>Error</span>}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{item.riskScore !== undefined ? `${item.riskScore}/100` : '--'}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{item.complianceScore !== undefined ? `${item.complianceScore}%` : '--'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {item.primaryCitation ? <span className="badge badge-low">{item.primaryCitation}</span> : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

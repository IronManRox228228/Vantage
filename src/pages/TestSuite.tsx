import React, { useState } from 'react';
import { TestTube, Play, CheckCircle, XCircle } from 'lucide-react';
import { extractHmiFeatures } from '../lib/workerExtractor';
import { hashDistance, addPlant, getAllPlants } from '../lib/dbService';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export const TestSuite: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const testList: TestResult[] = [];

    // Test 1: pHash distance formula
    try {
      const h1 = '1100110011001100110011001100110011001100110011001100110011001100';
      const h2 = '1100110011001100110011001100110011001100110011001100110011001111';
      const dist = hashDistance(h1, h2);
      if (dist === 2) {
        testList.push({ name: 'Perceptual Hash Distance Metric', passed: true, message: 'Calculated exact 2-bit Hamming distance.' });
      } else {
        testList.push({ name: 'Perceptual Hash Distance Metric', passed: false, message: `Expected distance 2, got ${dist}` });
      }
    } catch (e: any) {
      testList.push({ name: 'Perceptual Hash Distance Metric', passed: false, message: e.message });
    }

    // Test 2: Feature extraction algorithm on synthetic 100x100 canvas
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 100, 100);
        const imgData = ctx.getImageData(0, 0, 100, 100);
        const feat = extractHmiFeatures(imgData);
        if (feat.riskScore > 0 && feat.alarmDensity > 0.8) {
          testList.push({ name: 'Deterministic Feature Extraction Engine', passed: true, message: `Successfully detected high alarm pixel ratio (${(feat.alarmDensity * 100).toFixed(0)}%).` });
        } else {
          testList.push({ name: 'Deterministic Feature Extraction Engine', passed: false, message: `Risk calculation mismatch: ${feat.riskScore}` });
        }
      }
    } catch (e: any) {
      testList.push({ name: 'Deterministic Feature Extraction Engine', passed: false, message: e.message });
    }

    // Test 3: Database layer persistence
    try {
      const p = await addPlant({ name: 'Test Refinery Unit', location: 'Unit Test', industry_type: 'Testing' });
      const all = await getAllPlants();
      if (all.some((x) => x.id === p.id)) {
        testList.push({ name: 'Hybrid Supabase & Local Database Layer', passed: true, message: 'Successfully inserted & queried plant asset record.' });
      } else {
        testList.push({ name: 'Hybrid Supabase & Local Database Layer', passed: false, message: 'Inserted plant record not found.' });
      }
    } catch (e: any) {
      testList.push({ name: 'Hybrid Supabase & Local Database Layer', passed: false, message: e.message });
    }

    setResults(testList);
    setIsRunning(false);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)' }}>
            <TestTube size={18} color="var(--amber)" />
            ALGORITHM & DATABASE TEST HARNESS
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Validate ISA-101 algorithms, contrast ratio formulas, and Supabase integration
          </p>
        </div>

        <button className="btn btn-primary" onClick={runTests} disabled={isRunning}>
          <Play size={14} /> {isRunning ? 'Running Tests...' : 'Execute Test Suite'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--teal)' }}>Test Execution Results</h3>
        {results.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Click "Execute Test Suite" above to run unit and integration tests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {results.map((r, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg)',
                  border: `1px solid ${r.passed ? 'rgba(63, 184, 166, 0.3)' : 'rgba(226, 80, 74, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {r.passed ? <CheckCircle size={18} color="var(--teal)" /> : <XCircle size={18} color="var(--red)" />}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: r.passed ? 'var(--teal)' : 'var(--red)' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

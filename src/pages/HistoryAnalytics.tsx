import React, { useState, useEffect } from 'react';
import { History, Filter, Trash2, TrendingUp, RefreshCw, Layers } from 'lucide-react';
import { getAllAnalysisRuns, deleteAnalysisRun, seedDemoData, getAllPlants } from '../lib/dbService';
import { AnalysisRun, Plant } from '../lib/supabase';

export const HistoryAnalytics: React.FC = () => {
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    let data = await getAllAnalysisRuns();
    if (data.length === 0) {
      await seedDemoData();
      data = await getAllAnalysisRuns();
    }
    setRuns(data);
    const p = await getAllPlants();
    setPlants(p);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this historical analysis run?')) return;
    await deleteAnalysisRun(id);
    await loadData();
  };

  const filteredRuns = selectedPlantFilter === 'all'
    ? runs
    : runs.filter((r) => r.plant_id === selectedPlantFilter);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)' }}>
            <History size={18} color="var(--amber)" />
            HISTORICAL AUDIT ANALYTICS & TRENDS
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Track HMI compliance risk reduction over time across redesign iterations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--muted)" />
            <select
              value={selectedPlantFilter}
              onChange={(e) => setSelectedPlantFilter(e.target.value)}
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}
            >
              <option value="all">All Plants & Sites</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button className="btn" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Historical Audit List */}
      <div className="card">
        <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--teal)' }}>
          Audit Run Timeline ({filteredRuns.length} Runs)
        </h3>

        {loading ? (
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Loading historical records...</p>
        ) : filteredRuns.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No historical audit runs found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                <th style={{ padding: '8px 12px' }}>Timestamp</th>
                <th style={{ padding: '8px 12px' }}>Plant / Screen</th>
                <th style={{ padding: '8px 12px' }}>Risk Score</th>
                <th style={{ padding: '8px 12px' }}>Compliance</th>
                <th style={{ padding: '8px 12px' }}>Cog. Load</th>
                <th style={{ padding: '8px 12px' }}>Violations</th>
                <th style={{ padding: '8px 12px' }}>AI Model</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => {
                const dateStr = new Date(Number(run.timestamp)).toLocaleString();
                const plantObj = plants.find((p) => p.id === run.plant_id);
                return (
                  <tr key={run.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: '11px' }}>{dateStr}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{plantObj?.name || 'Jamnagar CDU-1'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{run.screen_id || 'SCR-001'}</div>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: run.risk_score > 50 ? 'var(--red)' : 'var(--teal)' }}>
                      {run.risk_score}/100
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: run.compliance_score > 70 ? 'var(--teal)' : 'var(--amber)' }}>
                      {run.compliance_score}%
                    </td>
                    <td style={{ padding: '8px 12px' }}>{run.cognitive_load}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="badge badge-high">{run.issues_count_by_severity?.high || 0} High</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--muted)' }}>{run.ai_model_version}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button
                        className="btn"
                        onClick={() => handleDelete(run.id)}
                        style={{ padding: '4px 8px', borderColor: 'var(--red)', color: 'var(--red)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

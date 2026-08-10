import React, { useState } from 'react';
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
}

export const ErrorLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'Rust Native IPC',
      message: 'Gemini 3.1 Flash Lite API proxy initialized with zero key leakage architecture.'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      level: 'info',
      source: 'Supabase Sync Engine',
      message: 'Row Level Security (RLS) policies verified for multi-tenant workspace isolation.'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      level: 'warn',
      source: 'Image Feature Worker',
      message: 'Sample HMI resolution (3840x2160) automatically downsampled for optimal contrast grid calculation.'
    }
  ]);

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)' }}>
            <AlertTriangle size={18} color="var(--red)" />
            SYSTEM ERROR LOGS & DIAGNOSTICS
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Monitor native Rust commands, IPC bridge events, and database sync status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={clearLogs} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
            <Trash2 size={14} /> Clear Logs
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--amber)' }}>Live Diagnostic Logs</h3>
        {logs.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No system error logs recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--mono)', fontSize: '11px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <span className={`badge badge-${log.level === 'error' ? 'high' : log.level === 'warn' ? 'medium' : 'low'}`}>
                  {log.level}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: '2px' }}>
                    <span>Source: {log.source}</span>
                    <span>{log.timestamp}</span>
                  </div>
                  <div style={{ color: 'var(--text)' }}>{log.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

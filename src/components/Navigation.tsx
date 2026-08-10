import React from 'react';
import { LayoutDashboard, Layers, History, AlertTriangle, TestTube, Database, ShieldCheck } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenPlantModal: () => void;
  isOnline: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenPlantModal,
  isOnline,
}) => {
  const navItems = [
    { id: 'audit', label: 'Single Audit', icon: LayoutDashboard },
    { id: 'batch', label: 'Batch Audit', icon: Layers },
    { id: 'history', label: 'History Analytics', icon: History },
    { id: 'logs', label: 'Error Logs', icon: AlertTriangle },
    { id: 'tests', label: 'Test Suite', icon: TestTube },
  ];

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--mono)',
            fontSize: '16px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            VANTAGE <span style={{ color: 'var(--amber)' }}>AUDITOR</span>
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
            ISA-101 / NUREG-0700 HMI Compliance & Safety Auditor
          </p>
        </div>

        <div style={{
          marginLeft: '16px',
          padding: '3px 8px',
          borderRadius: '12px',
          background: isOnline ? 'var(--teal-dim)' : 'var(--amber-dim)',
          border: `1px solid ${isOnline ? 'rgba(63, 184, 166, 0.3)' : 'rgba(240, 165, 0, 0.3)'}`,
          color: isOnline ? 'var(--teal)' : 'var(--amber)',
          fontSize: '10px',
          fontFamily: 'var(--mono)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Database size={12} />
          {isOnline ? 'Supabase Sync Active' : 'Offline Mode (Local Storage)'}
        </div>
      </div>

      <nav style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="btn"
              style={{
                background: isActive ? 'var(--surface-2)' : 'transparent',
                borderColor: isActive ? 'var(--amber)' : 'var(--line)',
                color: isActive ? 'var(--amber)' : 'var(--text)',
              }}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}

        <button
          onClick={onOpenPlantModal}
          className="btn"
          style={{ marginLeft: '8px', borderColor: 'var(--teal)', color: 'var(--teal)' }}
        >
          <ShieldCheck size={14} />
          Plants & Screens
        </button>
      </nav>
    </header>
  );
};

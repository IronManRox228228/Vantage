import React, { useState, useEffect } from 'react';
import { X, Plus, Building2, Monitor } from 'lucide-react';
import { getAllPlants, addPlant, getAllScreens, addScreen } from '../lib/dbService';
import { Plant, Screen } from '../lib/supabase';

interface PlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScreen?: (plantId: string, screenId: string) => void;
}

export const PlantModal: React.FC<PlantModalProps> = ({ isOpen, onClose, onSelectScreen }) => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantLocation, setNewPlantLocation] = useState('');
  const [newPlantIndustry, setNewPlantIndustry] = useState('Oil & Gas');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenTag, setNewScreenTag] = useState('');

  const loadData = async () => {
    const p = await getAllPlants();
    const s = await getAllScreens();
    setPlants(p);
    setScreens(s);
    if (p.length > 0 && !selectedPlantId) {
      setSelectedPlantId(p[0].id);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName.trim()) return;
    const plant = await addPlant({
      name: newPlantName,
      location: newPlantLocation || 'Site A',
      industry_type: newPlantIndustry,
    });
    setNewPlantName('');
    setNewPlantLocation('');
    setSelectedPlantId(plant.id);
    await loadData();
  };

  const handleAddScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScreenName.trim() || !selectedPlantId) return;
    await addScreen({
      plant_id: selectedPlantId,
      name: newScreenName,
      tag: newScreenTag || 'SCR-001',
      screen_type: 'overview',
    });
    setNewScreenName('');
    setNewScreenTag('');
    await loadData();
  };

  const filteredScreens = screens.filter((s) => s.plant_id === selectedPlantId);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)' }}>
            <Building2 size={18} color="var(--amber)" />
            PLANT & SCREEN ASSET MANAGER
          </h2>
          <button className="btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left Column: Plants */}
          <div>
            <h3 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--amber)' }}>Industrial Plants</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {plants.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlantId(p.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    background: selectedPlantId === p.id ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${selectedPlantId === p.id ? 'var(--amber)' : 'var(--line)'}`,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{p.location} • {p.industry_type}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddPlant} style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>+ Add New Plant</div>
              <input
                type="text"
                placeholder="Plant Name (e.g. CDU Unit 2)"
                value={newPlantName}
                onChange={(e) => setNewPlantName(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: '4px', marginBottom: '6px', fontSize: '11px' }}
              />
              <input
                type="text"
                placeholder="Location (e.g. Gujarat, IN)"
                value={newPlantLocation}
                onChange={(e) => setNewPlantLocation(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: '4px', marginBottom: '8px', fontSize: '11px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={12} /> Add Plant
              </button>
            </form>
          </div>

          {/* Right Column: Screens */}
          <div>
            <h3 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--teal)' }}>
              HMI Screens ({filteredScreens.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {filteredScreens.length === 0 ? (
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>No screens configured for this plant.</p>
              ) : (
                filteredScreens.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (onSelectScreen) onSelectScreen(selectedPlantId, s.id);
                      onClose();
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Monitor size={12} color="var(--teal)" />
                        {s.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Tag: {s.tag}</div>
                    </div>
                    <span className="badge badge-low">{s.screen_type}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddScreen} style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>+ Add Screen to Plant</div>
              <input
                type="text"
                placeholder="Screen Name (e.g. CDU Distillation Overview)"
                value={newScreenName}
                onChange={(e) => setNewScreenName(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: '4px', marginBottom: '6px', fontSize: '11px' }}
              />
              <input
                type="text"
                placeholder="Screen Tag (e.g. HMI-CDU-101)"
                value={newScreenTag}
                onChange={(e) => setNewScreenTag(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: '4px', marginBottom: '8px', fontSize: '11px' }}
              />
              <button type="submit" className="btn" style={{ width: '100%', borderColor: 'var(--teal)', color: 'var(--teal)' }}>
                <Plus size={12} /> Add HMI Screen
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

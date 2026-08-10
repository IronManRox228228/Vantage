import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { PlantModal } from './components/PlantModal';
import { SingleAudit } from './pages/SingleAudit';
import { BatchAudit } from './pages/BatchAudit';
import { HistoryAnalytics } from './pages/HistoryAnalytics';
import { ErrorLogs } from './pages/ErrorLogs';
import { TestSuite } from './pages/TestSuite';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('audit');
  const [isPlantModalOpen, setIsPlantModalOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPlantModal={() => setIsPlantModalOpen(true)}
        isOnline={isOnline}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'audit' && <SingleAudit />}
        {activeTab === 'batch' && <BatchAudit />}
        {activeTab === 'history' && <HistoryAnalytics />}
        {activeTab === 'logs' && <ErrorLogs />}
        {activeTab === 'tests' && <TestSuite />}
      </main>

      <PlantModal
        isOpen={isPlantModalOpen}
        onClose={() => setIsPlantModalOpen(false)}
      />
    </div>
  );
};

import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/shared/Sidebar';
import { Procesos } from './pages/Procesos';
import { Evaluaciones } from './pages/Evaluaciones';
import { InsightsProcesos } from './pages/InsightsProcesos';
import { DashboardGeneral } from './pages/DashboardGeneral';
import { Encuestas } from './pages/Encuestas';
import { ChatPanel } from './components/chat/ChatPanel';

export default function App() {
  const { activePage, loadProcesos, loading, error } = useStore();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    loadProcesos();
  }, [loadProcesos]);

  const renderPage = () => {
    switch (activePage) {
      case 'procesos': return <Procesos />;
      case 'evaluaciones': return <Evaluaciones />;
      case 'insights': return <InsightsProcesos />;
      case 'encuestas': return <Encuestas />;
      case 'dashboard': return <DashboardGeneral />;
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden" style={{ marginLeft: 240 }}>
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Cargando datos...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="m-6 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}
        {!loading && !error && renderPage()}
      </main>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <button
        onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{
          background: chatOpen ? 'var(--bg-elevated)' : 'var(--primary)',
          color: '#fff', border: chatOpen ? '1px solid var(--border)' : 'none',
          fontSize: '1.5rem', zIndex: 1001,
        }}
        title="Consultar procesos"
      >
        {chatOpen ? '\u00D7' : '\uD83D\uDCAC'}
      </button>
    </div>
  );
}

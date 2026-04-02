import { create } from 'zustand';
import type { Proceso, PageId } from '../types';

const REFRESH_INTERVAL = 5 * 60_000; // 5 minutos

interface AppState {
  procesos: Proceso[];
  loading: boolean;
  error: string | null;
  activePage: PageId;
  selectedProceso: Proceso | null;
  dataSource: 'airtable' | 'static';
  lastRefresh: number | null;

  loadProcesos: () => Promise<void>;
  refreshProcesos: () => Promise<void>;
  startAutoRefresh: () => () => void;
  setActivePage: (page: PageId) => void;
  setSelectedProceso: (p: Proceso | null) => void;
}

async function fetchProcesos(): Promise<{ data: Proceso[]; source: 'airtable' | 'static' }> {
  try {
    const resp = await fetch('/api/procesos');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) return { data, source: 'airtable' };
    }
  } catch {}
  const fallback = await fetch('/data/procesos.json');
  const data = await fallback.json();
  return { data, source: 'static' };
}

export const useStore = create<AppState>((set, get) => ({
  procesos: [],
  loading: false,
  error: null,
  activePage: 'procesos',
  selectedProceso: null,
  dataSource: 'static',
  lastRefresh: null,

  loadProcesos: async () => {
    if (get().procesos.length > 0) return;
    set({ loading: true, error: null });
    try {
      const { data, source } = await fetchProcesos();
      set({ procesos: data, loading: false, dataSource: source, lastRefresh: Date.now() });
    } catch {
      set({ error: 'Error al cargar datos.', loading: false });
    }
  },

  refreshProcesos: async () => {
    try {
      const { data, source } = await fetchProcesos();
      set({ procesos: data, dataSource: source, lastRefresh: Date.now() });
    } catch {
      // Silent fail on refresh — keep existing data
    }
  },

  startAutoRefresh: () => {
    const id = setInterval(() => {
      get().refreshProcesos();
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  },

  setActivePage: (page) => set({ activePage: page, selectedProceso: null }),
  setSelectedProceso: (p) => set({ selectedProceso: p }),
}));

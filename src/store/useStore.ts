import { create } from 'zustand';
import type { Proceso, PageId } from '../types';

interface AppState {
  procesos: Proceso[];
  loading: boolean;
  error: string | null;
  activePage: PageId;
  selectedProceso: Proceso | null;
  dataSource: 'airtable' | 'static';

  loadProcesos: () => Promise<void>;
  setActivePage: (page: PageId) => void;
  setSelectedProceso: (p: Proceso | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  procesos: [],
  loading: false,
  error: null,
  activePage: 'procesos',
  selectedProceso: null,
  dataSource: 'static',

  loadProcesos: async () => {
    if (get().procesos.length > 0) return;
    set({ loading: true, error: null });
    try {
      // Try Airtable API first
      const resp = await fetch('/api/procesos');
      if (resp.ok) {
        const data: Proceso[] = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          set({ procesos: data, loading: false, dataSource: 'airtable' });
          return;
        }
      }
      // Fallback to static JSON
      const fallback = await fetch('/data/procesos.json');
      const data: Proceso[] = await fallback.json();
      set({ procesos: data, loading: false, dataSource: 'static' });
    } catch {
      // Last resort: try static JSON
      try {
        const fallback = await fetch('/data/procesos.json');
        const data: Proceso[] = await fallback.json();
        set({ procesos: data, loading: false, dataSource: 'static' });
      } catch {
        set({ error: 'Error al cargar datos.', loading: false });
      }
    }
  },

  setActivePage: (page) => set({ activePage: page, selectedProceso: null }),
  setSelectedProceso: (p) => set({ selectedProceso: p }),
}));

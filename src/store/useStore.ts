import { create } from 'zustand';
import type { Proceso, PageId } from '../types';

interface AppState {
  procesos: Proceso[];
  loading: boolean;
  error: string | null;
  activePage: PageId;
  selectedProceso: Proceso | null;

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

  loadProcesos: async () => {
    if (get().procesos.length > 0) return;
    set({ loading: true, error: null });
    try {
      const resp = await fetch('/data/procesos.json');
      const data: Proceso[] = await resp.json();
      set({ procesos: data, loading: false });
    } catch {
      set({ error: 'Error al cargar datos.', loading: false });
    }
  },

  setActivePage: (page) => set({ activePage: page, selectedProceso: null }),
  setSelectedProceso: (p) => set({ selectedProceso: p }),
}));

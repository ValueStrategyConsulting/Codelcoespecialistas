import React, { useMemo } from 'react';
import type { Proceso } from '../../types';

export interface GlobalFilterValues {
  division: string;
  especialista: string;
  fechaDesde: string;
  fechaHasta: string;
}

export const defaultGlobalFilters: GlobalFilterValues = {
  division: '',
  especialista: '',
  fechaDesde: '',
  fechaHasta: '',
};

export function applyGlobalFilters(procesos: Proceso[], filters: GlobalFilterValues): Proceso[] {
  let result = procesos;
  if (filters.division) result = result.filter(p => p.division === filters.division);
  if (filters.especialista) result = result.filter(p => p.especialista === filters.especialista);
  if (filters.fechaDesde) result = result.filter(p => p.fecha_inicio >= filters.fechaDesde);
  if (filters.fechaHasta) result = result.filter(p => p.fecha_inicio <= filters.fechaHasta);
  return result;
}

interface Props {
  procesos: Proceso[];
  filters: GlobalFilterValues;
  onChange: (filters: GlobalFilterValues) => void;
  children?: React.ReactNode;
}

const selectSt: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '7px 10px',
  borderRadius: 8,
  fontSize: 13,
  minWidth: 140,
  outline: 'none',
};

const dateSt: React.CSSProperties = {
  ...selectSt,
  minWidth: 130,
  colorScheme: 'dark',
};

export const GlobalFilters: React.FC<Props> = ({ procesos, filters, onChange, children }) => {
  const divisiones = useMemo(() => [...new Set(procesos.map(p => p.division).filter(Boolean))].sort(), [procesos]);
  const especialistas = useMemo(() => [...new Set(procesos.map(p => p.especialista).filter(Boolean))].sort(), [procesos]);

  const set = (key: keyof GlobalFilterValues, value: string) => onChange({ ...filters, [key]: value });

  const hasFilters = filters.division || filters.especialista || filters.fechaDesde || filters.fechaHasta;

  return (
    <div
      className="flex flex-wrap gap-2 items-center px-5 py-3"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Division */}
      <select value={filters.division} onChange={e => set('division', e.target.value)} style={selectSt}>
        <option value="">Todas las divisiones</option>
        {divisiones.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      {/* Especialista */}
      <select value={filters.especialista} onChange={e => set('especialista', e.target.value)} style={selectSt}>
        <option value="">Todos los especialistas</option>
        {especialistas.map(e => <option key={e} value={e}>{e}</option>)}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 2 }}>Desde</span>
        <input type="date" value={filters.fechaDesde} onChange={e => set('fechaDesde', e.target.value)} style={dateSt} />
      </div>
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 2 }}>Hasta</span>
        <input type="date" value={filters.fechaHasta} onChange={e => set('fechaHasta', e.target.value)} style={dateSt} />
      </div>

      {hasFilters && (
        <button
          onClick={() => onChange({ ...defaultGlobalFilters })}
          style={{
            background: 'transparent', color: 'var(--danger)',
            border: '1px solid var(--danger)', padding: '6px 12px',
            borderRadius: 8, fontSize: 12, cursor: 'pointer',
          }}
        >
          Limpiar
        </button>
      )}

      {/* Slot for page-specific filters */}
      {children}
    </div>
  );
};

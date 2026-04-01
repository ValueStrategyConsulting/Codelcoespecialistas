import React, { useMemo, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { StatusBadge, EstadoGeneralBadge, DocStatusBadge } from '../components/shared/StatusBadge';
import { ProgressBar } from '../components/shared/ProgressBar';
import { ESTADO_LABELS, ESTADO_COLORS } from '../utils/calculations';
import { GlobalFilters, defaultGlobalFilters, applyGlobalFilters } from '../components/shared/GlobalFilters';
import type { GlobalFilterValues } from '../components/shared/GlobalFilters';
import type { Proceso, EstadoGeneral } from '../types';

const PAGE_SIZE = 50;

type SortKey =
  | 'id'
  | 'nombre'
  | 'rut'
  | 'cargo'
  | 'especialista'
  | 'categoria'
  | 'estado_documental'
  | 'estado_evaluacion'
  | 'estado_entrevista'
  | 'estado_cierre'
  | 'estado_general'
  | 'progreso'
  | 'observacion_control';

type SortDir = 'asc' | 'desc';

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  minWidth: 0,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto' as const,
};

export const Procesos: React.FC = () => {
  const procesos = useStore((s) => s.procesos);
  const selectedProceso = useStore((s) => s.selectedProceso);
  const setSelectedProceso = useStore((s) => s.setSelectedProceso);

  // Global filters
  const [gf, setGf] = useState<GlobalFilterValues>({...defaultGlobalFilters});

  // Filters
  const [search, setSearch] = useState('');
  const [filterCargo, setFilterCargo] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Pagination
  const [page, setPage] = useState(0);

  // Derived filter options
  const cargos = useMemo(() => {
    const freq = new Map<string, number>();
    procesos.forEach((p) => freq.set(p.cargo, (freq.get(p.cargo) || 0) + 1));
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([c]) => c)
      .sort();
  }, [procesos]);
  const categorias = useMemo(
    () => [...new Set(procesos.map((p) => p.categoria))].filter(Boolean).sort(),
    [procesos],
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilterCargo('');
    setFilterCategoria('');
    setFilterEstado('');
    setPage(0);
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = applyGlobalFilters(procesos, gf);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.rut.toLowerCase().includes(q) ||
          p.cargo.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q),
      );
    }
    if (filterCargo) list = list.filter((p) => p.cargo === filterCargo);
    if (filterCategoria) list = list.filter((p) => p.categoria === filterCategoria);
    if (filterEstado) list = list.filter((p) => p.estado_general === filterEstado);

    // Sort
    const sorted = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [procesos, gf, search, filterCargo, filterCategoria, filterEstado, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const columns: { key: SortKey; label: string; width?: string }[] = [
    { key: 'id', label: 'ID', width: '70px' },
    { key: 'cargo', label: 'Cargo', width: '160px' },
    { key: 'nombre', label: 'Candidato', width: '180px' },
    { key: 'rut', label: 'RUT', width: '110px' },
    { key: 'division' as SortKey, label: 'Divisi\u00f3n', width: '120px' },
    { key: 'especialista', label: 'Especialista', width: '150px' },
    { key: 'categoria', label: 'Categor\u00eda', width: '110px' },
    { key: 'estado_documental', label: 'Documental', width: '100px' },
    { key: 'estado_evaluacion', label: 'Evaluaci\u00f3n', width: '100px' },
    { key: 'estado_general', label: 'Estado', width: '120px' },
    { key: 'progreso', label: 'Progreso', width: '120px' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Global + page-specific filters */}
      <GlobalFilters procesos={procesos} filters={gf} onChange={setGf}>
        <input
          type="text"
          placeholder="Buscar nombre, RUT, cargo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          style={{ ...inputStyle, flex: '1 1 200px', maxWidth: '280px' }}
        />
        <select
          value={filterCargo}
          onChange={(e) => {
            setFilterCargo(e.target.value);
            setPage(0);
          }}
          style={selectStyle}
        >
          <option value="">Todos los cargos</option>
          {cargos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCategoria}
          onChange={(e) => {
            setFilterCategoria(e.target.value);
            setPage(0);
          }}
          style={selectStyle}
        >
          <option value="">Todas las categor\u00edas</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => {
            setFilterEstado(e.target.value);
            setPage(0);
          }}
          style={selectStyle}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABELS) as EstadoGeneral[]).map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
        <button
          onClick={resetFilters}
          style={{
            ...inputStyle,
            cursor: 'pointer',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          Limpiar
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} procesos
        </span>
      </GlobalFilters>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '16px' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 10px',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    fontSize: '11px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    width: col.width,
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--bg-base)',
                    zIndex: 1,
                  }}
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((p) => (
              <tr
                key={p.id + p.rut}
                onClick={() => setSelectedProceso(p)}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{p.id}</td>
                <td style={{ padding: '10px', color: 'var(--text)', fontWeight: 500 }}>{p.nombre}</td>
                <td style={{ padding: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                  {p.rut}
                </td>
                <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{p.cargo}</td>
                <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{p.especialista}</td>
                <td style={{ padding: '10px' }}>
                  <StatusBadge status={p.categoria} color={ESTADO_COLORS[p.estado_general] || 'var(--text-muted)'} />
                </td>
                <td style={{ padding: '10px' }}>
                  <DocStatusBadge complete={p.estado_documental === 'COMPLETO'} />
                </td>
                <td style={{ padding: '10px' }}>
                  <DocStatusBadge complete={p.estado_evaluacion === 'COMPLETA'} />
                </td>
                <td style={{ padding: '10px' }}>
                  <DocStatusBadge complete={p.estado_entrevista === 'COMPLETA'} />
                </td>
                <td style={{ padding: '10px' }}>
                  <DocStatusBadge complete={p.estado_cierre === 'CERRADO'} />
                </td>
                <td style={{ padding: '10px' }}>
                  <EstadoGeneralBadge estado={p.estado_general} />
                </td>
                <td style={{ padding: '10px', minWidth: '100px' }}>
                  <ProgressBar value={p.progreso} />
                </td>
                <td
                  style={{
                    padding: '10px',
                    color: 'var(--text-muted)',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p.observacion_control}
                >
                  {p.observacion_control || '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 0',
          }}
        >
          <button
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              ...inputStyle,
              cursor: safePage === 0 ? 'default' : 'pointer',
              opacity: safePage === 0 ? 0.4 : 1,
            }}
          >
            Anterior
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            P\u00e1gina {safePage + 1} de {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            style={{
              ...inputStyle,
              cursor: safePage >= totalPages - 1 ? 'default' : 'pointer',
              opacity: safePage >= totalPages - 1 ? 0.4 : 1,
            }}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedProceso && (
        <DetailDrawer proceso={selectedProceso} onClose={() => setSelectedProceso(null)} />
      )}
    </div>
  );
};

// ------- Detail Drawer -------

const DetailDrawer: React.FC<{ proceso: Proceso; onClose: () => void }> = ({ proceso, onClose }) => {
  const p = proceso;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '450px',
          maxWidth: '100vw',
          backgroundColor: 'var(--bg-base)',
          borderLeft: '1px solid var(--border)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideIn 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>#{p.id}</div>
            <h2 style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 700, margin: 0 }}>{p.cargo}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>{p.nombre}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            \u2715
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {/* Info section */}
          <Section title="Informaci\u00f3n">
            <InfoRow label="RUT" value={p.rut} />
            <InfoRow label="Correo" value={p.correo} />
            <InfoRow label="Tel\u00e9fono" value={p.telefono} />
            <InfoRow label="Divisi\u00f3n" value={p.division} />
            <InfoRow label="Categor\u00eda" value={p.categoria} />
          </Section>

          {/* Status breakdown */}
          <Section title="Estado por Etapa">
            <StatusRow label="Documental">
              <DocStatusBadge complete={p.estado_documental === 'COMPLETO'} />
            </StatusRow>
            <StatusRow label="Evaluaci\u00f3n">
              <DocStatusBadge complete={p.estado_evaluacion === 'COMPLETA'} />
            </StatusRow>
            <StatusRow label="Entrevista">
              <DocStatusBadge complete={p.estado_entrevista === 'COMPLETA'} />
            </StatusRow>
            <StatusRow label="Cierre">
              <DocStatusBadge complete={p.estado_cierre === 'CERRADO'} />
            </StatusRow>
          </Section>

          {/* Progress */}
          <Section title="Progreso">
            <div style={{ marginBottom: '8px' }}>
              <ProgressBar value={p.progreso} size="md" />
            </div>
          </Section>

          {/* Estado General */}
          <Section title="Estado General">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <EstadoGeneralBadge estado={p.estado_general} />
              {p.dias_sin_movimiento > 0 && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {p.dias_sin_movimiento} d\u00edas sin movimiento
                </span>
              )}
            </div>
          </Section>

          {/* Observaciones */}
          <Section title="Observaciones">
            <p
              style={{
                color: p.observacion_control ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: '13px',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {p.observacion_control || 'Sin observaciones registradas.'}
            </p>
          </Section>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

// ------- Small helpers -------

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <h4
      style={{
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '12px',
      }}
    >
      {title}
    </h4>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid var(--border)',
    }}
  >
    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{label}</span>
    <span style={{ color: 'var(--text)', fontSize: '13px', textAlign: 'right' }}>{value || '\u2014'}</span>
  </div>
);

const StatusRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}
  >
    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{label}</span>
    {children}
  </div>
);

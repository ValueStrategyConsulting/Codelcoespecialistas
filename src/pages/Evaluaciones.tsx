import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { KPICard } from '../components/shared/KPICard';
import { StatusBadge, DocStatusBadge } from '../components/shared/StatusBadge';
import { ProgressBar } from '../components/shared/ProgressBar';
import { GlobalFilters, defaultGlobalFilters, applyGlobalFilters } from '../components/shared/GlobalFilters';
import type { GlobalFilterValues } from '../components/shared/GlobalFilters';
import type { Proceso } from '../types';

const PAGE_SIZE = 25;

type SortKey = 'candidatos' | 'id' | 'cargo' | 'progreso';
type SortDir = 'asc' | 'desc';

interface ProcessGroup {
  id: string;
  cargo: string;
  candidates: Proceso[];
  avgProgreso: number;
  completasCount: number;
  riesgoCount: number;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  minWidth: '180px',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
};

function getCategoriaColor(cat: string): string {
  const normalized = (cat || '').toUpperCase().trim();
  if (normalized === 'RECOMENDADO' || normalized === 'RECOMENDADA') return '#10b981';
  if (normalized === 'NO RECOMENDADO' || normalized === 'NO RECOMENDADA') return '#ef4444';
  if (normalized === 'SIN EV. PSICOLABORAL') return '#f59e0b';
  if (normalized === 'DESISTE' || normalized === 'DESCARTADO' || normalized === 'DESCARTADA') return '#64748b';
  if (!cat) return '#64748b';
  return '#64748b';
}

export const Evaluaciones: React.FC = () => {
  const procesos = useStore((s) => s.procesos);

  const [globalFilters, setGlobalFilters] = useState<GlobalFilterValues>({ ...defaultGlobalFilters });
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [evalFilter, setEvalFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('candidatos');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Apply global filters
  const globalFiltered = useMemo(() => applyGlobalFilters(procesos, globalFilters), [procesos, globalFilters]);

  // Derive unique categorias from data
  const categorias = useMemo(
    () => [...new Set(globalFiltered.map((p) => p.categoria).filter(Boolean))].sort(),
    [globalFiltered],
  );

  // Apply page-specific filters
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return globalFiltered.filter(
      (p) =>
        (!categoriaFilter || p.categoria === categoriaFilter) &&
        (!evalFilter || p.estado_evaluacion === evalFilter) &&
        (!q || p.id.toLowerCase().includes(q) || p.cargo.toLowerCase().includes(q)),
    );
  }, [globalFiltered, categoriaFilter, evalFilter, search]);

  // Group by process ID
  const groups = useMemo<ProcessGroup[]>(() => {
    const map = new Map<string, Proceso[]>();
    for (const p of filtered) {
      const existing = map.get(p.id);
      if (existing) existing.push(p);
      else map.set(p.id, [p]);
    }
    return [...map.entries()].map(([id, candidates]) => {
      const avgProgreso = Math.round(
        candidates.reduce((sum, c) => sum + c.progreso, 0) / candidates.length,
      );
      const completasCount = candidates.filter((c) => c.estado_evaluacion === 'COMPLETA').length;
      const riesgoCount = candidates.filter((c) => c.estado_general === 'EN_RIESGO').length;
      return {
        id,
        cargo: candidates[0].cargo,
        candidates,
        avgProgreso,
        completasCount,
        riesgoCount,
      };
    });
  }, [filtered]);

  // Sort groups
  const sortedGroups = useMemo(() => {
    const copy = [...groups];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'candidatos':
          cmp = a.candidates.length - b.candidates.length;
          break;
        case 'id':
          cmp = a.id.localeCompare(b.id);
          break;
        case 'cargo':
          cmp = a.cargo.localeCompare(b.cargo);
          break;
        case 'progreso':
          cmp = a.avgProgreso - b.avgProgreso;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [groups, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / PAGE_SIZE));
  const paginatedGroups = sortedGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // KPI calculations
  const uniqueProcessCount = groups.length;
  const totalCandidatos = filtered.length;
  const evalCompletas = filtered.filter((p) => p.estado_evaluacion === 'COMPLETA').length;
  const pctCompletas = totalCandidatos > 0 ? Math.round((evalCompletas / totalCandidatos) * 100) : 0;
  const enRiesgoCount = filtered.filter((p) => p.estado_general === 'EN_RIESGO').length;
  const pctRiesgo = totalCandidatos > 0 ? Math.round((enRiesgoCount / totalCandidatos) * 100) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'candidatos' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const sortLabel = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text)',
      }}
    >
      {/* Global Filters */}
      <GlobalFilters procesos={procesos} filters={globalFilters} onChange={setGlobalFilters}>
        <input
          placeholder="Buscar por ID o cargo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          style={inputStyle}
        />
        <select
          value={categoriaFilter}
          onChange={(e) => {
            setCategoriaFilter(e.target.value);
            setPage(0);
          }}
          style={inputStyle}
        >
          <option value="">Todas las categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={evalFilter}
          onChange={(e) => {
            setEvalFilter(e.target.value);
            setPage(0);
          }}
          style={inputStyle}
        >
          <option value="">Todos los estados</option>
          <option value="COMPLETA">Completa</option>
          <option value="PENDIENTE">Pendiente</option>
        </select>
      </GlobalFilters>

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <KPICard label="Total Procesos" value={uniqueProcessCount} color="var(--primary)" />
          <KPICard label="Total Candidatos" value={totalCandidatos} color="var(--primary)" />
          <KPICard
            label="Evaluaciones Completas"
            value={`${pctCompletas}%`}
            subtitle={`${evalCompletas} de ${totalCandidatos}`}
            color="var(--success)"
          />
          <KPICard
            label="En Riesgo"
            value={`${pctRiesgo}%`}
            subtitle={`${enRiesgoCount} candidatos`}
            color="var(--danger)"
          />
        </div>

        {/* Sort controls */}
        <div
          className="flex items-center gap-3"
          style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}
        >
          <span style={{ fontWeight: 600 }}>Ordenar por:</span>
          {([
            ['candidatos', 'Candidatos'],
            ['id', 'ID'],
            ['cargo', 'Cargo'],
            ['progreso', 'Progreso'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              style={{
                background: sortKey === key ? 'var(--bg-elevated)' : 'transparent',
                border: sortKey === key ? '1px solid var(--primary)' : '1px solid var(--border)',
                color: sortKey === key ? 'var(--primary)' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: sortKey === key ? 600 : 400,
              }}
            >
              {label}{sortLabel(key)}
            </button>
          ))}
        </div>

        {/* Accordion list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {paginatedGroups.map((group) => {
            const isExpanded = expandedId === group.id;
            return (
              <div
                key={group.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  borderLeft: '3px solid var(--primary)',
                  overflow: 'hidden',
                }}
              >
                {/* Accordion header */}
                <div
                  onClick={() => toggleExpand(group.id)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '16px',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Left: ID + Cargo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '280px' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: 'var(--primary)',
                      }}
                    >
                      #{group.id}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                      {group.cargo}
                    </span>
                  </div>

                  {/* Center: candidate count */}
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      minWidth: '100px',
                    }}
                  >
                    {group.candidates.length} candidato{group.candidates.length !== 1 ? 's' : ''}
                  </span>

                  {/* Right metrics */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginLeft: 'auto',
                    }}
                  >
                    <div style={{ width: '120px' }}>
                      <ProgressBar value={group.avgProgreso} size="sm" />
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--success)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {group.completasCount} completa{group.completasCount !== 1 ? 's' : ''}
                    </span>
                    {group.riesgoCount > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--danger)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {group.riesgoCount} riesgo
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-muted)',
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'inline-block',
                      }}
                    >
                      {'\u25BC'}
                    </span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      overflowX: 'auto',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Candidato</th>
                          <th style={thStyle}>RUT</th>
                          <th style={thStyle}>Categoria</th>
                          <th style={thStyle}>Est. Documental</th>
                          <th style={thStyle}>Est. Evaluacion</th>
                          <th style={thStyle}>Informe</th>
                          <th style={thStyle}>Check Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.candidates.map((c, idx) => (
                          <tr
                            key={`${c.rut}-${idx}`}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            <td style={tdStyle}>{c.nombre}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>
                              {c.rut}
                            </td>
                            <td style={tdStyle}>
                              <StatusBadge
                                status={c.categoria || '-'}
                                color={getCategoriaColor(c.categoria)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <DocStatusBadge complete={c.estado_documental === 'COMPLETO'} />
                            </td>
                            <td style={tdStyle}>
                              <DocStatusBadge complete={c.estado_evaluacion === 'COMPLETA'} />
                            </td>
                            <td style={tdStyle}>
                              <DocStatusBadge complete={c.has_informe} />
                            </td>
                            <td style={tdStyle}>
                              <DocStatusBadge complete={c.has_check_final} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {paginatedGroups.length === 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              Sin resultados
            </div>
          )}
        </div>
      </div>

      {/* Pagination bar */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {sortedGroups.length} procesos ({filtered.length} candidatos) — Pagina {page + 1} de{' '}
            {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{
                ...inputStyle,
                minWidth: 'auto',
                padding: '4px 12px',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                opacity: page === 0 ? 0.5 : 1,
              }}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              style={{
                ...inputStyle,
                minWidth: 'auto',
                padding: '4px 12px',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages - 1 ? 0.5 : 1,
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

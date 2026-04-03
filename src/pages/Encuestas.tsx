import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { KPICard } from '../components/shared/KPICard';
import { encuestasService } from '../data/encuestasService';
import { generatePDFReport } from '../utils/pdfReport';
import type { Encuesta, EncuestaCalidad } from '../types';

const TT: React.CSSProperties = {
  backgroundColor: '#1e293b', border: '1px solid #1f2937', borderRadius: 8,
  color: '#f9fafb', fontSize: 12, padding: '8px 12px',
};

const selectSt: React.CSSProperties = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  outline: 'none', minWidth: 160,
};

type SortKey = 'especialista' | 'contestadas' | 'no_contestadas' | 'total_enviadas' | 'porcentaje';
type SortDir = 'asc' | 'desc';

// Aggregate rows by especialista
interface AggRow {
  especialista: string;
  contestadas: number;
  no_contestadas: number;
  total_enviadas: number;
  porcentaje: number;
}

function aggregate(data: Encuesta[]): AggRow[] {
  const map = new Map<string, { c: number; nc: number; t: number }>();
  for (const e of data) {
    const entry = map.get(e.especialista) || { c: 0, nc: 0, t: 0 };
    entry.c += e.contestadas;
    entry.nc += e.no_contestadas;
    entry.t += e.total_enviadas;
    map.set(e.especialista, entry);
  }
  return [...map.entries()].map(([especialista, { c, nc, t }]) => ({
    especialista,
    contestadas: c,
    no_contestadas: nc,
    total_enviadas: t,
    porcentaje: t > 0 ? Math.round((c / t) * 100) : 0,
  }));
}

const MES_LABELS: Record<string, string> = {
  '2026-01': 'Enero 2026',
  '2026-02': 'Febrero 2026',
  '2026-03': 'Marzo 2026',
};

export const Encuestas: React.FC = () => {
  const meses = encuestasService.getMeses();
  const tipos = encuestasService.getTipos();

  const [filterMes, setFilterMes] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('porcentaje');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);

  // Real Airtable encuestas de calidad
  const [encuestasCalidad, setEncuestasCalidad] = useState<EncuestaCalidad[]>([]);
  const [loadingCalidad, setLoadingCalidad] = useState(false);

  React.useEffect(() => {
    setLoadingCalidad(true);
    fetch('/api/encuestas')
      .then(r => r.ok ? r.json() : [])
      .then((data: EncuestaCalidad[]) => setEncuestasCalidad(Array.isArray(data) ? data : []))
      .catch(() => setEncuestasCalidad([]))
      .finally(() => setLoadingCalidad(false));
  }, []);

  // Aggregate calidad by especialista
  const calidadByEsp = useMemo(() => {
    const map = new Map<string, { count: number; sumInf: number; countInf: number; sumDoc: number; countDoc: number }>();
    for (const e of encuestasCalidad) {
      if (!e.especialista) continue;
      const entry = map.get(e.especialista) || { count: 0, sumInf: 0, countInf: 0, sumDoc: 0, countDoc: 0 };
      entry.count++;
      if (e.puntaje_informes != null) { entry.sumInf += e.puntaje_informes; entry.countInf++; }
      if (e.puntaje_documentos != null) { entry.sumDoc += e.puntaje_documentos; entry.countDoc++; }
      map.set(e.especialista, entry);
    }
    return [...map.entries()].map(([esp, d]) => ({
      especialista: esp,
      evaluaciones: d.count,
      promInformes: d.countInf > 0 ? Math.round((d.sumInf / d.countInf) * 10) / 10 : null,
      promDocumentos: d.countDoc > 0 ? Math.round((d.sumDoc / d.countDoc) * 10) / 10 : null,
    })).sort((a, b) => b.evaluaciones - a.evaluaciones);
  }, [encuestasCalidad]);

  const filtered = useMemo(() => encuestasService.filterEncuestas(
    filterMes || undefined, filterTipo || undefined,
  ), [filterMes, filterTipo]);

  const rows = useMemo(() => aggregate(filtered), [filtered]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  // KPIs (computed from unfiltered rows)
  const totalEnviadas = rows.reduce((s, r) => s + r.total_enviadas, 0);
  const totalContestadas = rows.reduce((s, r) => s + r.contestadas, 0);
  const totalNoContestadas = rows.reduce((s, r) => s + r.no_contestadas, 0);
  const pctGlobal = totalEnviadas > 0 ? Math.round((totalContestadas / totalEnviadas) * 100) : 0;

  // Apply KPI filter to table
  const tableRows = useMemo(() => {
    if (!kpiFilter) return sorted;
    switch (kpiFilter) {
      case 'contestadas': return sorted.filter(r => r.porcentaje >= 60);
      case 'no_contestadas': return sorted.filter(r => r.porcentaje < 55);
      default: return sorted;
    }
  }, [sorted, kpiFilter]);

  // Chart data
  const barData = useMemo(() =>
    tableRows.map(r => ({
      name: r.especialista.split(' ').slice(0, 2).join(' '),
      fullName: r.especialista,
      porcentaje: r.porcentaje,
    })), [tableRows]);

  const stackedData = useMemo(() =>
    tableRows.map(r => ({
      name: r.especialista.split(' ').slice(0, 2).join(' '),
      fullName: r.especialista,
      Contestadas: r.contestadas,
      'No contestadas': r.no_contestadas,
    })), [tableRows]);

  // Monthly data for bar chart
  const monthlyData = useMemo(() => {
    const map = new Map<string, { contestadas: number; no_contestadas: number }>();
    for (const e of filtered) {
      const entry = map.get(e.mes) || { contestadas: 0, no_contestadas: 0 };
      entry.contestadas += e.contestadas;
      entry.no_contestadas += e.no_contestadas;
      map.set(e.mes, entry);
    }
    return Array.from(map, ([mes, d]) => ({
      name: MES_LABELS[mes] || mes,
      Contestadas: d.contestadas,
      'No contestadas': d.no_contestadas,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // Ranking
  const top5 = useMemo(() => [...rows].sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 5), [rows]);
  const bottom5 = useMemo(() => [...rows].sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 5), [rows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const sortInd = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const handleDownloadPDF = () => {
    const mesLabel = filterMes ? (MES_LABELS[filterMes] || filterMes) : 'Todos los meses';
    const tipoLabel = filterTipo || 'Todos los tipos';
    generatePDFReport({
      title: 'Informe de Encuestas de Satisfacción',
      subtitle: 'ATS Codelco | Transearch',
      filterDescription: `${mesLabel} · ${tipoLabel}`,
      kpis: [
        { label: 'Total Enviadas', value: totalEnviadas.toLocaleString() },
        { label: 'Contestadas', value: totalContestadas.toLocaleString() },
        { label: 'No Contestadas', value: totalNoContestadas.toLocaleString() },
        { label: '% Respuesta', value: `${pctGlobal}%` },
      ],
      tables: [
        {
          title: 'Detalle por Especialista',
          headers: ['Especialista', 'Contestadas', 'No Contestadas', 'Total Enviadas', '% Respuesta'],
          rows: sorted.map(r => [r.especialista, r.contestadas, r.no_contestadas, r.total_enviadas, `${r.porcentaje}%`]),
        },
        {
          title: 'Top Performers',
          headers: ['#', 'Especialista', '% Respuesta'],
          rows: top5.map((r, i) => [i + 1, r.especialista, `${r.porcentaje}%`]),
        },
        {
          title: 'Necesitan Atención',
          headers: ['#', 'Especialista', '% Respuesta'],
          rows: bottom5.map((r, i) => [i + 1, r.especialista, `${r.porcentaje}%`]),
        },
      ],
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center px-5 py-3"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <select value={filterMes} onChange={e => setFilterMes(e.target.value)} style={selectSt}>
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m} value={m}>{MES_LABELS[m] || m}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={selectSt}>
          <option value="">Todos los tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filterMes || filterTipo) && (
          <button onClick={() => { setFilterMes(''); setFilterTipo(''); }}
            style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          {rows.length} especialistas · {totalEnviadas.toLocaleString()} encuestas
        </span>
        <button onClick={handleDownloadPDF}
          style={{ background: 'var(--primary)', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>&#8595;</span> Descargar PDF
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPICard label="Total Enviadas" value={totalEnviadas.toLocaleString()} color="var(--primary)" />
          <KPICard label="Contestadas" value={totalContestadas.toLocaleString()} color="var(--success)" onClick={() => setKpiFilter(kpiFilter === 'contestadas' ? null : 'contestadas')} active={kpiFilter === 'contestadas'} subtitle={kpiFilter === 'contestadas' ? 'Mostrando ≥60%' : undefined} />
          <KPICard label="No Contestadas" value={totalNoContestadas.toLocaleString()} color="var(--danger)" onClick={() => setKpiFilter(kpiFilter === 'no_contestadas' ? null : 'no_contestadas')} active={kpiFilter === 'no_contestadas'} subtitle={kpiFilter === 'no_contestadas' ? 'Mostrando <55%' : undefined} />
          <KPICard label="% Respuesta Global" value={`${pctGlobal}%`} color="var(--primary)" />
        </div>

        {/* Table */}
        <Card title="Detalle por Especialista">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {([
                    ['especialista', 'Especialista'],
                    ['contestadas', 'Contestadas'],
                    ['no_contestadas', 'No Contestadas'],
                    ['total_enviadas', 'Total Enviadas'],
                    ['porcentaje', '% Respuesta'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} onClick={() => handleSort(key)}
                      style={{ textAlign: key === 'especialista' ? 'left' : 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none' }}>
                      {label}{sortInd(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(r => (
                  <tr key={r.especialista} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{r.especialista}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--success)', textAlign: 'right', fontWeight: 600 }}>{r.contestadas}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--danger)', textAlign: 'right' }}>{r.no_contestadas}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>{r.total_enviadas}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-2">
                        <div style={{ width: 60, height: 5, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${r.porcentaje}%`, height: '100%', borderRadius: 3, background: r.porcentaje >= 80 ? 'var(--success)' : r.porcentaje >= 50 ? 'var(--primary)' : 'var(--danger)' }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 12, color: r.porcentaje >= 80 ? 'var(--success)' : r.porcentaje >= 50 ? 'var(--primary)' : 'var(--danger)', minWidth: 32, textAlign: 'right' }}>
                          {r.porcentaje}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
          {/* % Respuesta por especialista */}
          <Card title="% Respuesta por Especialista">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1f2937" angle={-35} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <Tooltip contentStyle={TT} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''} formatter={(v: number) => [`${v}%`, 'Respuesta']} />
                <Bar dataKey="porcentaje" radius={[4, 4, 0, 0]} barSize={20}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.porcentaje >= 80 ? '#10b981' : d.porcentaje >= 50 ? '#3b82f6' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Stacked: Contestadas vs No contestadas */}
          <Card title="Contestadas vs No Contestadas">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stackedData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1f2937" angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <Tooltip contentStyle={TT} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''} />
                <Bar dataKey="Contestadas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="No contestadas" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Encuestas por mes */}
        <div style={{ marginTop: 16 }}>
          <Card title="Encuestas por Mes">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="Contestadas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="No contestadas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Evaluación de Calidad (datos reales Airtable) */}
        {calidadByEsp.length > 0 && (
          <Card title={`Evaluación de Calidad por Especialista (${encuestasCalidad.length} evaluaciones)`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Especialista', 'Evaluaciones', 'Prom. Informes', 'Prom. Documentos'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Especialista' ? 'left' : 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calidadByEsp.map(r => (
                    <tr key={r.especialista} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{r.especialista}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>{r.evaluaciones}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: r.promInformes != null ? (r.promInformes >= 4 ? 'var(--success)' : r.promInformes >= 3 ? 'var(--primary)' : 'var(--danger)') : 'var(--text-muted)' }}>
                        {r.promInformes != null ? r.promInformes : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: r.promDocumentos != null ? (r.promDocumentos >= 4 ? 'var(--success)' : r.promDocumentos >= 3 ? 'var(--primary)' : 'var(--danger)') : 'var(--text-muted)' }}>
                        {r.promDocumentos != null ? r.promDocumentos : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {loadingCalidad && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Cargando evaluaciones de calidad desde Airtable...
          </div>
        )}

        {/* Rankings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Card title="Top Performers">
            {top5.map((r, i) => (
              <RankRow key={r.especialista} rank={i + 1} name={r.especialista} value={r.porcentaje}
                color={r.porcentaje >= 80 ? 'var(--success)' : 'var(--primary)'} />
            ))}
          </Card>
          <Card title="Necesitan Atención">
            {bottom5.map((r, i) => (
              <RankRow key={r.especialista} rank={i + 1} name={r.especialista} value={r.porcentaje}
                color={r.porcentaje < 50 ? 'var(--danger)' : 'var(--warning)'} />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
};

function RankRow({ rank, name, value, color }: { rank: number; name: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
        {rank}
      </span>
      <span className="flex-1 truncate" style={{ fontSize: 13, color: 'var(--text)' }}>{name}</span>
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <div style={{ width: 50, height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>{value}%</span>
      </div>
    </div>
  );
}

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
    <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</h4>
    {children}
  </div>
);

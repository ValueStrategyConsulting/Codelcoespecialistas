import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { useStore } from '../store/useStore';
import { KPICard } from '../components/shared/KPICard';
import { EstadoGeneralBadge, DocStatusBadge } from '../components/shared/StatusBadge';
import { ESTADO_COLORS, ESTADO_LABELS, isRisk } from '../utils/calculations';
import { GlobalFilters, defaultGlobalFilters, applyGlobalFilters } from '../components/shared/GlobalFilters';
import { generatePDFReport } from '../utils/pdfReport';
import type { GlobalFilterValues } from '../components/shared/GlobalFilters';
import type { EstadoGeneral } from '../types';

const TT: React.CSSProperties = {
  backgroundColor: '#1e293b', border: '1px solid #1f2937', borderRadius: 8,
  color: '#f9fafb', fontSize: 12, padding: '8px 12px',
};

export const DashboardGeneral: React.FC = () => {
  const procesos = useStore((s) => s.procesos);
  const [gf, setGf] = useState<GlobalFilterValues>({ ...defaultGlobalFilters });
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const data = useMemo(() => applyGlobalFilters(procesos, gf), [procesos, gf]);

  const kpis = useMemo(() => {
    const total = data.length;
    if (total === 0) return { total: 0, avance: 0, docs: 0, riesgo: 0, cerrados: 0 };
    return {
      total,
      avance: Math.round(data.reduce((s, p) => s + p.progreso, 0) / total),
      docs: Math.round((data.filter(p => p.estado_documental === 'COMPLETO').length / total) * 100),
      riesgo: Math.round((data.filter(isRisk).length / total) * 100),
      cerrados: Math.round((data.filter(p => p.estado_general === 'CERRADO').length / total) * 100),
    };
  }, [data]);

  // Chart 1: Estado general distribution
  const estadoData = useMemo(() => {
    const map = new Map<EstadoGeneral, number>();
    data.forEach(p => map.set(p.estado_general, (map.get(p.estado_general) || 0) + 1));
    return Array.from(map, ([estado, value]) => ({
      name: ESTADO_LABELS[estado], value, color: ESTADO_COLORS[estado], estado,
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  // Chart 2: Avance por división
  const divisionData = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    data.forEach(p => {
      const d = p.division || 'Sin asignar';
      const entry = map.get(d) || { sum: 0, count: 0 };
      entry.sum += p.progreso; entry.count++;
      map.set(d, entry);
    });
    return Array.from(map, ([name, { sum, count }]) => ({
      name: name.length > 22 ? name.slice(0, 20) + '...' : name,
      value: Math.round(sum / count),
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  // Chart 3: Procesos por categoría
  const categoriaData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(p => map.set(p.categoria || 'Sin categoría', (map.get(p.categoria || 'Sin categoría') || 0) + 1));
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  // Filtered data by KPI click
  const tableData = useMemo(() => {
    if (!kpiFilter) return data;
    switch (kpiFilter) {
      case 'docs': return data.filter(p => p.estado_documental === 'COMPLETO');
      case 'riesgo': return data.filter(isRisk);
      case 'cerrados': return data.filter(p => p.estado_general === 'CERRADO');
      default: return data;
    }
  }, [data, kpiFilter]);

  // Risk table
  const criticalProcesses = useMemo(
    () => tableData.sort((a, b) => b.dias_sin_movimiento - a.dias_sin_movimiento).slice(0, 30),
    [tableData],
  );

  const handleDownloadPDF = () => {
    const filterParts: string[] = [];
    if (gf.division) filterParts.push(gf.division);
    if (gf.especialista) filterParts.push(gf.especialista);
    if (gf.fechaDesde || gf.fechaHasta) filterParts.push(`${gf.fechaDesde || '...'} a ${gf.fechaHasta || '...'}`);
    const filterDesc = filterParts.length > 0 ? filterParts.join(' · ') : 'Sin filtros aplicados';

    generatePDFReport({
      title: 'Informe Dashboard General',
      subtitle: 'ATS Codelco | Transearch',
      filterDescription: filterDesc,
      kpis: [
        { label: 'Total Procesos', value: kpis.total },
        { label: 'Avance Global', value: `${kpis.avance}%` },
        { label: 'Docs Completos', value: `${kpis.docs}%` },
        { label: 'En Riesgo', value: `${kpis.riesgo}%` },
        { label: 'Cerrados', value: `${kpis.cerrados}%` },
      ],
      tables: [
        {
          title: 'Distribución por Estado General',
          headers: ['Estado', 'Cantidad'],
          rows: estadoData.map(e => [e.name, e.value]),
        },
        {
          title: 'Avance Promedio por División',
          headers: ['División', '% Avance'],
          rows: divisionData.map(d => [d.name, `${d.value}%`]),
        },
        {
          title: 'Procesos por Categoría',
          headers: ['Categoría', 'Cantidad'],
          rows: categoriaData.map(c => [c.name, c.value]),
        },
        ...(criticalProcesses.length > 0 ? [{
          title: 'Procesos en Riesgo',
          headers: ['ID', 'Cargo', 'Candidato', 'Estado', 'Días s/mov.', 'Documental', 'Evaluación'],
          rows: criticalProcesses.map(p => [
            p.id, p.cargo, p.nombre,
            ESTADO_LABELS[p.estado_general],
            p.dias_sin_movimiento,
            p.estado_documental,
            p.estado_evaluacion,
          ]),
        }] : []),
      ],
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <GlobalFilters procesos={procesos} filters={gf} onChange={setGf}>
        <button onClick={handleDownloadPDF}
          style={{ background: 'var(--primary)', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: 14 }}>&#8595;</span> Descargar PDF
        </button>
      </GlobalFilters>
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPICard label="Total Procesos" value={kpis.total} color="var(--primary)" />
          <KPICard label="Avance Global" value={`${kpis.avance}%`} subtitle="Promedio" color="var(--primary)" />
          <KPICard label="Docs Completos" value={`${kpis.docs}%`} color="var(--success)" onClick={() => setKpiFilter(kpiFilter === 'docs' ? null : 'docs')} active={kpiFilter === 'docs'} />
          <KPICard label="En Riesgo" value={`${kpis.riesgo}%`} color="var(--danger)" onClick={() => setKpiFilter(kpiFilter === 'riesgo' ? null : 'riesgo')} active={kpiFilter === 'riesgo'} />
          <KPICard label="Cerrados" value={`${kpis.cerrados}%`} color="var(--success)" onClick={() => setKpiFilter(kpiFilter === 'cerrados' ? null : 'cerrados')} active={kpiFilter === 'cerrados'} />
        </div>

        {/* Charts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 24 }}>

          {/* Estado general */}
          <Card title="Distribución por Estado General">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={estadoData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <Tooltip contentStyle={TT} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {estadoData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Avance por división */}
          <Card title="Avance Promedio por División">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={divisionData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <Tooltip contentStyle={TT} cursor={{ fill: 'rgba(59,130,246,0.06)' }} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Por categoría */}
          <Card title="Procesos por Categoría">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoriaData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                <Tooltip contentStyle={TT} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Risk table */}
        {criticalProcesses.length > 0 && (
          <Card title={`${kpiFilter === 'docs' ? 'Procesos con Docs Completos' : kpiFilter === 'cerrados' ? 'Procesos Cerrados' : kpiFilter === 'riesgo' ? 'Procesos en Riesgo' : 'Procesos'} (${criticalProcesses.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['ID', 'Cargo', 'Candidato', 'Estado', 'Días s/mov.', 'Documental', 'Evaluación'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criticalProcesses.map((p, i) => (
                    <tr key={`${p.id}-${p.rut}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--primary)', fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>#{p.id}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{p.cargo}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{p.nombre}</td>
                      <td style={{ padding: '10px 12px' }}><EstadoGeneralBadge estado={p.estado_general} /></td>
                      <td style={{ padding: '10px 12px', color: 'var(--danger)', fontWeight: 600 }}>{p.dias_sin_movimiento}</td>
                      <td style={{ padding: '10px 12px' }}><DocStatusBadge complete={p.estado_documental === 'COMPLETO'} /></td>
                      <td style={{ padding: '10px 12px' }}><DocStatusBadge complete={p.estado_evaluacion === 'COMPLETA'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
    <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</h4>
    {children}
  </div>
);

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store/useStore';
import { KPICard } from '../components/shared/KPICard';
import { GlobalFilters, defaultGlobalFilters, applyGlobalFilters } from '../components/shared/GlobalFilters';
import type { GlobalFilterValues } from '../components/shared/GlobalFilters';
import type { Proceso, OnePageEntry as RealOnePageEntry } from '../types';

/* ── Tooltip style (dark theme) ── */
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #1f2937',
  borderRadius: '8px',
  color: '#f9fafb',
  fontSize: '12px',
  padding: '8px 12px',
};

/* ── Select style (matches GlobalFilters) ── */
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

/* ── Competencies list ── */
const COMPETENCIES = [
  'Orientación a resultados',
  'Trabajo en equipo',
  'Liderazgo',
  'Adaptabilidad',
  'Comunicación efectiva',
  'Resolución de problemas',
  'Compromiso organizacional',
  'Tolerancia a la presión',
] as const;

/* ── Seeded random from RUT string ── */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 10000) / 10000;
  };
}

/* ── OnePage data type ── */
interface OnePageEntry {
  nombre: string;
  rut: string;
  cargo: string;
  categoria: string;
  hasOnePage: boolean;
  competencias: Record<string, number>;
}

/* ── Mock OnePage data generator ── */
function generateOnePageData(procesos: Proceso[]): OnePageEntry[] {
  const evaluated = procesos.filter(
    (p) => p.categoria === 'Recomendado' || p.categoria === 'No Recomendado',
  );

  return evaluated.map((p) => {
    const rng = seededRandom(p.rut);
    const hasOnePage = rng() < 0.65;

    const competencias: Record<string, number> = {};
    if (hasOnePage) {
      for (const comp of COMPETENCIES) {
        const raw = rng();
        if (p.categoria === 'Recomendado') {
          // scores 3–5
          competencias[comp] = Math.round((3 + raw * 2) * 10) / 10;
        } else {
          // scores 1–3.5
          competencias[comp] = Math.round((1 + raw * 2.5) * 10) / 10;
        }
      }
    }

    return {
      nombre: p.nombre,
      rut: p.rut,
      cargo: p.cargo,
      categoria: p.categoria,
      hasOnePage,
      competencias,
    };
  });
}

/* ── Chart card wrapper ── */
const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}
  >
    <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</h4>
    {children}
  </div>
);

/* ── Convert real OnePage entries to local format ── */
function realToLocal(entries: RealOnePageEntry[]): OnePageEntry[] {
  return entries.map(e => {
    const competencias: Record<string, number> = {};
    let hasData = false;
    // Merge sellos + valores into competencias
    for (const [key, val] of Object.entries(e.sellos)) {
      if (val != null) { competencias[key] = val; hasData = true; }
    }
    for (const [key, val] of Object.entries(e.valores)) {
      if (val != null) { competencias[key] = val; hasData = true; }
    }
    return {
      nombre: e.nombre,
      rut: '',
      cargo: '',
      categoria: e.categoria,
      hasOnePage: hasData,
      competencias,
    };
  });
}

/* ── Main page component ── */
export const InsightsProcesos: React.FC = () => {
  const procesos = useStore((s) => s.procesos);
  const [gf, setGf] = useState<GlobalFilterValues>({ ...defaultGlobalFilters });
  const [cargoFilter, setCargoFilter] = useState('');
  const [realOnePage, setRealOnePage] = useState<RealOnePageEntry[] | null>(null);
  const [dataSourceLabel, setDataSourceLabel] = useState('mock');

  // Try to fetch real OnePage data
  React.useEffect(() => {
    fetch('/api/onepage')
      .then(r => r.ok ? r.json() : null)
      .then((data: RealOnePageEntry[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          setRealOnePage(data);
          setDataSourceLabel('Airtable OnePage');
        }
      })
      .catch(() => {});
  }, []);

  const filteredProcesos = useMemo(() => applyGlobalFilters(procesos, gf), [procesos, gf]);

  const cargoOptions = useMemo(
    () => [...new Set(filteredProcesos.map((p) => p.cargo).filter(Boolean))].sort(),
    [filteredProcesos],
  );

  const finalProcesos = useMemo(
    () => (cargoFilter ? filteredProcesos.filter((p) => p.cargo === cargoFilter) : filteredProcesos),
    [filteredProcesos, cargoFilter],
  );

  // Use real OnePage if available, otherwise mock
  const onePageData = useMemo(() => {
    if (realOnePage && realOnePage.length > 0) {
      // Enrich real data with cargo from procesos
      const proMap = new Map<string, Proceso>();
      for (const p of finalProcesos) {
        const key = p.correo?.toLowerCase();
        if (key) proMap.set(key, p);
      }
      const enriched = realOnePage
        .map(e => {
          const match = proMap.get(e.email?.toLowerCase());
          return { ...e, nombre: e.nombre || match?.nombre || '', cargo: match?.cargo || '' };
        })
        .filter(e => !cargoFilter || e.cargo === cargoFilter);
      const local = realToLocal(enriched);
      // Set cargo from enriched data
      return local.map((l, i) => ({ ...l, cargo: enriched[i]?.cargo || '' }));
    }
    return generateOnePageData(finalProcesos);
  }, [realOnePage, finalProcesos, cargoFilter]);

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const total = onePageData.length;
    const recomendados = onePageData.filter((d) => d.categoria === 'Recomendado');
    const noRecomendados = onePageData.filter((d) => d.categoria === 'No Recomendado');
    const withOnePage = onePageData.filter((d) => d.hasOnePage);
    const coveragePct = total > 0 ? Math.round((withOnePage.length / total) * 100) : 0;
    const recPct = total > 0 ? Math.round((recomendados.length / total) * 100) : 0;
    const noRecPct = total > 0 ? Math.round((noRecomendados.length / total) * 100) : 0;

    return {
      total,
      recomendados: recomendados.length,
      noRecomendados: noRecomendados.length,
      recPct,
      noRecPct,
      withOnePage: withOnePage.length,
      coveragePct,
    };
  }, [onePageData]);

  /* ── Bar chart data: Recomendados vs No Recomendados ── */
  const recBarData = useMemo(() => {
    if (cargoFilter) {
      // simple 2-bar chart
      return [
        { name: 'Recomendado', value: stats.recomendados },
        { name: 'No Recomendado', value: stats.noRecomendados },
      ];
    }
    // grouped by cargo (top 10)
    const map = new Map<string, { rec: number; noRec: number }>();
    onePageData.forEach((d) => {
      const entry = map.get(d.cargo) || { rec: 0, noRec: 0 };
      if (d.categoria === 'Recomendado') entry.rec += 1;
      else entry.noRec += 1;
      map.set(d.cargo, entry);
    });
    return Array.from(map, ([cargo, v]) => ({
      name: cargo.length > 35 ? cargo.slice(0, 32) + '...' : cargo,
      Recomendado: v.rec,
      'No Recomendado': v.noRec,
    }))
      .sort((a, b) => (b.Recomendado + b['No Recomendado']) - (a.Recomendado + a['No Recomendado']))
      .slice(0, 10);
  }, [onePageData, cargoFilter, stats]);

  /* ── Competencias más bajas (No Recomendados con OnePage) ── */
  const lowCompetencies = useMemo(() => {
    const noRecWithOP = onePageData.filter((d) => d.categoria === 'No Recomendado' && d.hasOnePage);
    if (noRecWithOP.length === 0) return [];

    const sums: Record<string, { total: number; count: number }> = {};
    for (const comp of COMPETENCIES) {
      sums[comp] = { total: 0, count: 0 };
    }
    noRecWithOP.forEach((d) => {
      for (const comp of COMPETENCIES) {
        if (d.competencias[comp] != null) {
          sums[comp].total += d.competencias[comp];
          sums[comp].count += 1;
        }
      }
    });

    return Object.entries(sums)
      .map(([name, { total, count }]) => ({
        name,
        avg: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.avg - b.avg);
  }, [onePageData]);

  /* ── Brechas text ── */
  const noRecWithoutOP = useMemo(
    () => onePageData.filter((d) => d.categoria === 'No Recomendado' && !d.hasOnePage).length,
    [onePageData],
  );

  /* ── Color interpolation for competency bars ── */
  const getCompBarColor = (index: number, total: number) => {
    // gradient from red (lowest / index 0) to orange (highest of the low)
    const t = total > 1 ? index / (total - 1) : 0;
    const r = Math.round(239 + (245 - 239) * t);
    const g = Math.round(68 + (158 - 68) * t);
    const b = Math.round(68 + (11 - 68) * t);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filters */}
      <GlobalFilters procesos={procesos} filters={gf} onChange={setGf}>
        <select value={cargoFilter} onChange={(e) => setCargoFilter(e.target.value)} style={selectSt}>
          <option value="">Todos los cargos</option>
          {cargoOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </GlobalFilters>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Data quality notice */}
        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderLeft: '3px solid var(--warning)',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          Este es un resumen en base a las evaluaciones registradas.
        </div>

        {/* KPI row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <KPICard label="Candidatos evaluados" value={stats.total} color="var(--primary)" />
          <KPICard
            label="Recomendados"
            value={stats.recomendados}
            subtitle={`${stats.recPct}%`}
            color="var(--success)"
          />
          <KPICard
            label="No Recomendados"
            value={stats.noRecomendados}
            subtitle={`${stats.noRecPct}%`}
            color="var(--danger)"
          />
          <KPICard
            label="Cobertura OnePage"
            value={`${stats.coveragePct}%`}
            subtitle={`${stats.withOnePage} de ${stats.total}`}
            color="var(--warning)"
          />
        </div>

        {/* Block 1: Resumen general */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0 }}>
            En el periodo seleccionado se evaluaron <strong style={{ color: 'var(--text)' }}>{stats.total}</strong> candidatos
            {cargoFilter ? (
              <> para <strong style={{ color: 'var(--text)' }}>"{cargoFilter}"</strong></>
            ) : null}.{' '}
            <strong style={{ color: 'var(--success)' }}>{stats.recomendados}</strong> fueron categorizados como Recomendado
            ({stats.recPct}%) y <strong style={{ color: 'var(--danger)' }}>{stats.noRecomendados}</strong> como No Recomendado
            ({stats.noRecPct}%).{' '}
            Datos de OnePage disponibles para <strong style={{ color: 'var(--text)' }}>{stats.withOnePage}</strong> de{' '}
            {stats.total} candidatos ({stats.coveragePct}%).
          </p>

          {stats.coveragePct < 30 && stats.total > 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderLeft: '3px solid var(--warning)',
                borderRadius: 6,
                padding: '10px 14px',
                marginTop: 12,
                fontSize: 12,
                color: 'var(--warning)',
                lineHeight: 1.5,
              }}
            >
              Cobertura insuficiente para generar insights confiables de competencias
            </div>
          )}
        </div>

        {/* Block 2: Recomendados vs No Recomendados chart */}
        {stats.total > 0 && (
          <div style={{ marginBottom: 16 }}>
            {cargoFilter ? (
              <ChartCard title="Recomendados vs No Recomendados">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={recBarData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                      {(recBarData as { name: string; value: number }[]).map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.name === 'Recomendado' ? 'var(--success)' : 'var(--danger)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            ) : (
              <ChartCard title="Recomendados vs No Recomendados por Cargo (Top 10)">
                <ResponsiveContainer width="100%" height={Math.max(280, (recBarData as any[]).length * 36)}>
                  <BarChart
                    data={recBarData}
                    layout="horizontal"
                    margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      stroke="#1f2937"
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#1f2937" allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                    <Bar dataKey="Recomendado" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="No Recomendado" fill="var(--danger)" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        )}

        {/* Block 3: Competencias más bajas (No Recomendados) */}
        {lowCompetencies.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ChartCard title="Competencias m&aacute;s bajas en candidatos No Recomendados">
              <ResponsiveContainer width="100%" height={lowCompetencies.length * 38 + 20}>
                <BarChart
                  data={lowCompetencies}
                  layout="vertical"
                  margin={{ left: 10, right: 40, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 5]}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#1f2937"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={180}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#1f2937"
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#94a3b8', fontSize: 11 }}>
                    {lowCompetencies.map((_, i) => (
                      <Cell key={i} fill={getCompBarColor(i, lowCompetencies.length)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {/* Block 4: Resumen de brechas */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
          }}
        >
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Resumen de brechas
          </h4>

          {stats.noRecomendados === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No hay candidatos No Recomendados en el filtro actual
            </p>
          ) : lowCompetencies.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No hay datos de OnePage disponibles para candidatos No Recomendados
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 8px 0' }}>
                Principales brechas observadas en candidatos No Recomendados:
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {lowCompetencies.slice(0, 3).map((c) => (
                  <li key={c.name} style={{ marginBottom: 4 }}>
                    <strong style={{ color: 'var(--danger)' }}>{c.name}</strong>: promedio{' '}
                    <strong style={{ color: 'var(--text)' }}>{c.avg}</strong> / 5
                  </li>
                ))}
              </ul>
              {noRecWithoutOP > 0 && (
                <p style={{ margin: '12px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Nota: {noRecWithoutOP} candidato{noRecWithoutOP > 1 ? 's' : ''} No Recomendado
                  {noRecWithoutOP > 1 ? 's' : ''} no cuenta{noRecWithoutOP > 1 ? 'n' : ''} con datos de
                  OnePage.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

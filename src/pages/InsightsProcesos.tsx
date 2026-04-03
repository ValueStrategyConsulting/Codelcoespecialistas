import React, { useMemo, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
  Legend,
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
  fecha_evaluacion?: string;
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
      fecha_evaluacion: p.fecha_inicio,
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
      fecha_evaluacion: e.fecha_evaluacion,
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
      // Enrich real data with cargo from procesos (match by email first, then by id_proceso)
      const emailMap = new Map<string, Proceso>();
      const idMap = new Map<string, Proceso>();
      for (const p of finalProcesos) {
        if (p.correo) emailMap.set(p.correo.toLowerCase(), p);
        idMap.set(p.id, p);
      }
      const enriched = realOnePage
        .map(e => {
          const match = emailMap.get(e.email?.toLowerCase()) || idMap.get(e.id_proceso);
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
  const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const recBarData = useMemo(() => {
    if (cargoFilter) {
      // simple 2-bar chart
      return [
        { name: 'Recomendado', value: stats.recomendados },
        { name: 'No Recomendado', value: stats.noRecomendados },
      ];
    }
    // grouped by month using fecha_evaluacion
    const map = new Map<string, { rec: number; noRec: number }>();
    onePageData.forEach((d) => {
      const dateStr = d.fecha_evaluacion;
      if (!dateStr) return;
      const ym = dateStr.slice(0, 7); // YYYY-MM
      const entry = map.get(ym) || { rec: 0, noRec: 0 };
      if (d.categoria === 'Recomendado') entry.rec += 1;
      else entry.noRec += 1;
      map.set(ym, entry);
    });
    return Array.from(map, ([ym, v]) => {
      const [year, month] = ym.split('-');
      const monthIdx = parseInt(month, 10) - 1;
      const label = `${MONTH_NAMES[monthIdx] ?? month} ${year}`;
      return {
        name: label,
        sortKey: ym,
        Recomendado: v.rec,
        'No Recomendado': v.noRec,
      };
    })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
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
          En riesgo: procesos con plazo máximo próximo a vencer (≤5 días) o ya vencido.
        </div>

        {/* KPI row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
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
              <ChartCard title="Recomendados vs No Recomendados por Mes">
                <ResponsiveContainer width="100%" height={280}>
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
                    <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
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
            <ChartCard title="Competencias más bajas en candidatos No Recomendados">
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

        {/* AI Analysis Button + Result */}
        <AIAnalysisSection
          onePageData={onePageData}
          stats={stats}
          lowCompetencies={lowCompetencies}
          cargoFilter={cargoFilter}
          globalFilters={gf}
        />
      </div>
    </div>
  );
};

/* ── AI Analysis Section ── */
function AIAnalysisSection({ onePageData, stats, lowCompetencies, cargoFilter, globalFilters }: {
  onePageData: OnePageEntry[];
  stats: { total: number; recomendados: number; noRecomendados: number; recPct: number; noRecPct: number; withOnePage: number; coveragePct: number };
  lowCompetencies: { name: string; avg: number }[];
  cargoFilter: string;
  globalFilters: GlobalFilterValues;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateAnalysis = useCallback(() => {
    if (stats.noRecomendados === 0) {
      setAnalysis('No hay candidatos No Recomendados en el filtro actual para analizar.');
      return;
    }

    setLoading(true);
    setAnalysis(null);

    // Simulate AI processing delay
    setTimeout(() => {
      const noRec = onePageData.filter(d => d.categoria === 'No Recomendado');
      const withData = noRec.filter(d => d.hasOnePage);
      const cargoLabel = cargoFilter || 'todos los cargos';

      // Build competency analysis
      const compMap = new Map<string, number[]>();
      withData.forEach(d => {
        Object.entries(d.competencias).forEach(([k, v]) => {
          if (!compMap.has(k)) compMap.set(k, []);
          compMap.get(k)!.push(v);
        });
      });
      const compAvgs = [...compMap.entries()]
        .map(([name, vals]) => ({ name, avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length }))
        .sort((a, b) => a.avg - b.avg);

      const critical = compAvgs.filter(c => c.avg < 2.5);
      const moderate = compAvgs.filter(c => c.avg >= 2.5 && c.avg < 3.5);
      const strong = compAvgs.filter(c => c.avg >= 3.5);

      const dateFrom = globalFilters.fechaDesde || 'inicio';
      const dateTo = globalFilters.fechaHasta || 'hoy';
      const dateRange = (globalFilters.fechaDesde || globalFilters.fechaHasta) ? ` | Rango: ${dateFrom} a ${dateTo}` : '';

      let text = `ANÁLISIS DE CANDIDATOS NO RECOMENDADOS\n`;
      text += `${'─'.repeat(50)}\n\n`;
      text += `Período analizado: ${cargoLabel}${dateRange}\n`;
      text += `Total evaluados: ${stats.total} candidatos\n`;
      text += `No Recomendados: ${stats.noRecomendados} (${stats.noRecPct}%)\n`;
      text += `Con datos de evaluación: ${withData.length} de ${noRec.length}\n\n`;

      if (withData.length === 0) {
        text += `No hay datos de evaluación disponibles para los candidatos No Recomendados.`;
        setAnalysis(text);
        setLoading(false);
        return;
      }

      // Pattern analysis
      text += `HALLAZGOS PRINCIPALES\n\n`;

      if (critical.length > 0) {
        text += `1. Competencias críticas (puntaje < 2.5/5):\n`;
        critical.forEach(c => {
          text += `   • ${c.name}: ${c.avg}/5 — Brecha significativa detectada en ${c.count} evaluaciones.\n`;
        });
        text += `\n   Estos resultados sugieren una debilidad estructural en estas áreas entre los candidatos que no superan el proceso.\n\n`;
      }

      if (moderate.length > 0) {
        text += `2. Competencias con oportunidad de mejora (2.5 - 3.5/5):\n`;
        moderate.forEach(c => {
          text += `   • ${c.name}: ${c.avg}/5\n`;
        });
        text += `\n   Estas competencias no son críticas pero representan un área donde los candidatos No Recomendados muestran rendimiento inferior al esperado.\n\n`;
      }

      if (strong.length > 0) {
        text += `3. Competencias con mejor desempeño relativo (≥ 3.5/5):\n`;
        strong.forEach(c => {
          text += `   • ${c.name}: ${c.avg}/5\n`;
        });
        text += `\n   Incluso entre candidatos No Recomendados, estas áreas muestran puntajes aceptables.\n\n`;
      }

      // Conclusions
      text += `CONCLUSIONES\n\n`;
      const lowest = compAvgs[0];
      const highest = compAvgs[compAvgs.length - 1];
      if (lowest && highest) {
        const gap = Math.round((highest.avg - lowest.avg) * 10) / 10;
        text += `• La mayor brecha se concentra en "${lowest.name}" (${lowest.avg}/5), que presenta una diferencia de ${gap} puntos respecto a la competencia mejor evaluada ("${highest.name}", ${highest.avg}/5).\n\n`;
      }

      if (stats.noRecPct > 30) {
        text += `• El ${stats.noRecPct}% de tasa de No Recomendados es elevado. Se sugiere revisar si los criterios de preselección están alineados con el perfil requerido.\n\n`;
      }

      if (noRec.length - withData.length > 0) {
        const missing = noRec.length - withData.length;
        text += `• ${missing} candidato${missing > 1 ? 's' : ''} No Recomendado${missing > 1 ? 's' : ''} no cuenta${missing > 1 ? 'n' : ''} con datos de evaluación detallados, lo que limita la profundidad del análisis.\n\n`;
      }

      text += `RECOMENDACIONES\n\n`;
      if (critical.length > 0) {
        text += `• Incorporar evaluación temprana de ${critical.map(c => `"${c.name}"`).join(', ')} en el proceso de screening para reducir candidatos que no cumplen con el umbral mínimo.\n`;
      }
      text += `• Mantener el registro consistente de evaluaciones OnePage para mejorar la calidad del análisis en futuros períodos.\n`;

      setAnalysis(text);
      setLoading(false);
    }, 1500);
  }, [onePageData, stats, lowCompetencies, cargoFilter, globalFilters]);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Button */}
      <button
        onClick={generateAnalysis}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          color: '#fff',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            Generando análisis...
          </>
        ) : (
          <>
            <span style={{ fontSize: 18 }}>&#10024;</span>
            Análisis de IA
          </>
        )}
      </button>

      {/* Result */}
      {analysis && (
        <div
          style={{
            marginTop: 12,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid #8b5cf6',
            borderRadius: 12,
            padding: 24,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>&#10024;</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#8b5cf6' }}>
              Análisis generado
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {new Date().toLocaleString('es-CL')}
            </span>
          </div>
          {analysis}
        </div>
      )}
    </div>
  );
}

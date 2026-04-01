import type { Proceso } from '../types';
import { ESTADO_LABELS } from './calculations';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  data?: ChatResultData | null;
  timestamp: Date;
}

export interface CandidatoResumen {
  nombre: string;
  rut: string;
  cargo: string;
  division: string;
  categoria: string;
  estado_general: string;
  progreso: number;
  estado_documental: string;
  estado_evaluacion: string;
  estado_entrevista: string;
  estado_cierre: string;
  observacion: string;
  dias_sin_movimiento: number;
}

export interface ProcesoGroupResumen {
  id: string;
  cargo: string;
  division: string;
  total: number;
  avgProgreso: number;
  cerrados: number;
  enRiesgo: number;
  candidatos: CandidatoResumen[];
}

export interface ChatResultData {
  type: 'proceso' | 'candidato' | 'multi';
  procesos?: ProcesoGroupResumen[];
  candidatos?: CandidatoResumen[];
  query: string;
}

function toResumen(p: Proceso): CandidatoResumen {
  return {
    nombre: p.nombre,
    rut: p.rut,
    cargo: p.cargo,
    division: p.division,
    categoria: p.categoria,
    estado_general: ESTADO_LABELS[p.estado_general] || p.estado_general,
    progreso: p.progreso,
    estado_documental: p.estado_documental,
    estado_evaluacion: p.estado_evaluacion,
    estado_entrevista: p.estado_entrevista,
    estado_cierre: p.estado_cierre,
    observacion: p.observacion_control,
    dias_sin_movimiento: p.dias_sin_movimiento,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function processQuery(query: string, procesos: Proceso[]): { text: string; data: ChatResultData | null } {
  const q = query.trim();
  if (!q) return { text: 'Ingresa un ID de proceso, nombre o RUT para consultar.', data: null };

  // By ID
  if (/^#?\d{4,6}$/.test(q)) {
    const id = q.replace('#', '');
    return searchById(id, procesos);
  }
  // By RUT
  if (/^\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]$/.test(q)) {
    return searchByRut(q, procesos);
  }
  // Numeric = try ID
  if (/^\d+$/.test(q)) {
    return searchById(q, procesos);
  }
  // Name search
  return searchByName(q, procesos);
}

function searchById(id: string, procesos: Proceso[]): { text: string; data: ChatResultData | null } {
  const matches = procesos.filter(p => p.id === id);
  if (matches.length === 0) {
    const partial = procesos.filter(p => p.id.includes(id)).slice(0, 20);
    if (partial.length === 0) return { text: `No se encontró el proceso **#${id}**.`, data: null };
    const candidatos = partial.map(toResumen);
    return { text: `${partial.length} resultados parciales para "${id}":`, data: { type: 'multi', candidatos, query: id } };
  }

  const avgProg = Math.round(matches.reduce((s, p) => s + p.progreso, 0) / matches.length);
  const cerrados = matches.filter(p => p.estado_general === 'CERRADO').length;
  const riesgo = matches.filter(p => p.estado_general === 'EN_RIESGO').length;
  const group: ProcesoGroupResumen = {
    id, cargo: matches[0].cargo, division: matches[0].division || 'Sin asignar',
    total: matches.length, avgProgreso: avgProg, cerrados, enRiesgo: riesgo,
    candidatos: matches.map(toResumen),
  };

  return {
    text: `**Proceso #${id}** — ${group.cargo}\n` +
      `División: ${group.division} | Candidatos: ${group.total} | ` +
      `Avance: **${avgProg}%** | Cerrados: ${cerrados} | Riesgo: ${riesgo}`,
    data: { type: 'proceso', procesos: [group], query: id },
  };
}

function searchByRut(rut: string, procesos: Proceso[]): { text: string; data: ChatResultData | null } {
  const norm = rut.replace(/\./g, '').toLowerCase();
  const matches = procesos.filter(p => p.rut.replace(/\./g, '').toLowerCase().includes(norm));
  if (matches.length === 0) return { text: `No se encontró candidato con RUT **${rut}**.`, data: null };
  const p = matches[0];
  const c = toResumen(p);
  return {
    text: `**${p.nombre}** (${p.rut})\nProceso #${p.id} — ${p.cargo}\n` +
      `Estado: **${c.estado_general}** | Progreso: **${p.progreso}%**\n` +
      `Docs: ${c.estado_documental} | Evaluación: ${c.estado_evaluacion} | Cierre: ${c.estado_cierre}`,
    data: { type: 'candidato', candidatos: matches.map(toResumen), query: rut },
  };
}

function searchByName(name: string, procesos: Proceso[]): { text: string; data: ChatResultData | null } {
  const words = normalize(name).split(/\s+/).filter(Boolean);
  const matches = procesos.filter(p => {
    const n = normalize(p.nombre);
    return words.every(w => n.includes(w));
  });
  if (matches.length === 0) {
    const fuzzy = procesos.filter(p => { const n = normalize(p.nombre); return words.some(w => n.includes(w)); });
    if (fuzzy.length === 0) return { text: `No se encontró **"${name}"**.`, data: null };
    return { text: `${fuzzy.length} resultados parciales para "${name}":`, data: { type: 'multi', candidatos: fuzzy.slice(0, 15).map(toResumen), query: name } };
  }
  if (matches.length === 1) {
    const p = matches[0]; const c = toResumen(p);
    return {
      text: `**${p.nombre}** (${p.rut})\nProceso #${p.id} — ${p.cargo}\n` +
        `Estado: **${c.estado_general}** | Progreso: **${p.progreso}%**`,
      data: { type: 'candidato', candidatos: [c], query: name },
    };
  }
  return { text: `${matches.length} registros para "${name}":`, data: { type: 'multi', candidatos: matches.slice(0, 15).map(toResumen), query: name } };
}

import type { Proceso, Alert, EstadoGeneral } from '../types';

// Color mapping for estado_general
export const ESTADO_COLORS: Record<EstadoGeneral, string> = {
  POR_INICIAR: 'var(--text-muted)',
  EN_PROCESO: 'var(--primary)',
  EN_EVALUACION: 'var(--warning)',
  PENDIENTE_CIERRE: '#a78bfa',
  CERRADO: 'var(--success)',
  EN_RIESGO: 'var(--danger)',
};

export const ESTADO_LABELS: Record<EstadoGeneral, string> = {
  POR_INICIAR: 'Por Iniciar',
  EN_PROCESO: 'En Proceso',
  EN_EVALUACION: 'En Evaluación',
  PENDIENTE_CIERRE: 'Pend. Cierre',
  CERRADO: 'Cerrado',
  EN_RIESGO: 'En Riesgo',
};

export function isRisk(p: Proceso): boolean {
  return p.estado_general === 'EN_RIESGO';
}

export function generateAlerts(procesos: Proceso[]): Alert[] {
  const alerts: Alert[] = [];
  for (const p of procesos) {
    if (!p.has_documentos) {
      alerts.push({
        id: `${p.id}-${p.rut}-doc`,
        procesoId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        tipo: 'Documentos faltantes',
        severidad: 'alta',
        mensaje: `${p.nombre} no tiene documentos cargados`,
        accion: 'Solicitar documentación al candidato',
      });
    }
    if (!p.has_informe && p.has_documentos) {
      alerts.push({
        id: `${p.id}-${p.rut}-inf`,
        procesoId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        tipo: 'Informe pendiente',
        severidad: p.has_respaldo ? 'alta' : 'media',
        mensaje: `${p.nombre} no tiene informe psicolaboral`,
        accion: 'Generar y cargar informe psicolaboral',
      });
    }
    if (!p.has_respaldo && p.has_documentos) {
      alerts.push({
        id: `${p.id}-${p.rut}-ent`,
        procesoId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        tipo: 'Entrevista pendiente',
        severidad: 'media',
        mensaje: `${p.nombre} no tiene respaldo de entrevista`,
        accion: 'Agendar y registrar entrevista',
      });
    }
    if (!p.has_check_final && p.has_informe) {
      alerts.push({
        id: `${p.id}-${p.rut}-ck`,
        procesoId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        tipo: 'Check final pendiente',
        severidad: 'media',
        mensaje: `${p.nombre} tiene informe pero falta check final`,
        accion: 'Completar revisión final del proceso',
      });
    }
    if (p.observacion_control && p.estado_general !== 'CERRADO') {
      alerts.push({
        id: `${p.id}-${p.rut}-obs`,
        procesoId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        tipo: 'Observación activa',
        severidad: 'baja',
        mensaje: `Observación: ${p.observacion_control.slice(0, 80)}...`,
        accion: 'Revisar y resolver observación',
      });
    }
  }
  return alerts;
}

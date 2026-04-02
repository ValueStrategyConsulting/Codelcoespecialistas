export interface Proceso {
  id: string;
  cargo: string;
  nombre: string;
  correo: string;
  telefono: string;
  rut: string;
  division: string;
  categoria: string;
  documentos: string;
  documentos_count: number;
  has_documentos: boolean;
  informe_psicolaboral: string;
  has_informe: boolean;
  respaldo_entrevista: string;
  has_respaldo: boolean;
  observacion_control: string;
  check_final: string;
  has_check_final: boolean;
  estado_documental: 'COMPLETO' | 'PENDIENTE';
  estado_evaluacion: 'COMPLETA' | 'PENDIENTE';
  estado_entrevista: 'COMPLETA' | 'PENDIENTE';
  estado_cierre: 'CERRADO' | 'PENDIENTE';
  estado_general: EstadoGeneral;
  progreso: number;
  dias_sin_movimiento: number;
  fecha_inicio: string;
  fecha_ultimo_movimiento: string;
  plazo_maximo: string;
  dias_para_plazo: number | null;
  especialista: string;
}

export type EstadoGeneral =
  | 'POR_INICIAR'
  | 'EN_PROCESO'
  | 'EN_EVALUACION'
  | 'PENDIENTE_CIERRE'
  | 'CERRADO'
  | 'EN_RIESGO';

export type PageId =
  | 'procesos'
  | 'evaluaciones'
  | 'insights'
  | 'dashboard'
  | 'encuestas';

export type TipoEncuesta = 'Filtros' | 'CRS' | 'Examenes';

export interface Encuesta {
  mes: string;
  tipo_encuesta: TipoEncuesta;
  especialista: string;
  contestadas: number;
  no_contestadas: number;
  total_enviadas: number;
  porcentaje: number;
}

// Real Airtable Encuesta Psico + Docs
export interface EncuestaCalidad {
  id: string;
  fecha_ingreso: string;
  especialista: string;
  eval_informes: string;
  puntaje_informes: number | null;
  obs_positivas_psico: string;
  oportunidades_psico: string;
  eval_documentos: string;
  puntaje_documentos: number | null;
  fortalezas_docs: string;
  oportunidades_docs: string;
}

// Real Airtable OnePage entry
export interface OnePageEntry {
  id_proceso: string;
  email: string;
  nombre: string;
  fecha_evaluacion: string;
  categoria: string;
  resumen: string;
  motivacion: string;
  sellos: Record<string, number | null>;
  valores: Record<string, number | null>;
}

export interface Alert {
  id: string;
  procesoId: string;
  nombre: string;
  cargo: string;
  tipo: string;
  severidad: 'alta' | 'media' | 'baja';
  mensaje: string;
  accion: string;
}

import { fetchAllRecords, selectName, hasAttachments, attachmentCount } from './lib/airtable';

const BASE_ID = 'appH4ByfDsfJFEp0l';
const TABLE_ID = 'tblwulQitACgXEdya';

// Field IDs from Procesos Asignados table
const FIELDS = [
  'fldN9h09R9DIoZ0Ua', // ID
  'fldkkQeY7mN7R2IE2', // Cargo
  'fldIrp7BowX00HPov', // Nombre y Apellido
  'fld7bj2PUHJaPkZ4l', // Correo
  'fldfJ9af05hofzXsD', // Rut
  'fldyWOXWSgZGfYFp1', // Teléfono
  'fldTrRXp7w0F7gysW', // División
  'fldA9ccZcN6IYcAwh', // Categoría
  'fldTisHGAWKdlBAJT', // Documentos (attachments)
  'fldyu2auimhKo2dds', // Informe Psicolaboral (attachments)
  'fldgzNzj6JMUjsUVV', // Observación Control
  'fldCERHd9Gl6Sg129', // CHECK FINAL
  'fldDb7gl1Wjp3v1y4', // Especialista-1 (text)
  'fldo3fYbiNMsSLxzn', // Fecha de Inicio
  'fldAbIU21JSlcWdEO', // Última modificación
  'fldGGIWOrl2XNFRxF', // Estado
  'fldLftMbv6EnJMDYG', // Estado Documentos
  'fldyijp7KwS0jEQuT', // Plazo Máximo
];

function computeEstadoGeneral(
  hasDocs: boolean,
  hasInforme: boolean,
  hasCheckFinal: boolean,
  diasParaPlazo: number | null,
): string {
  let estado: string;
  if (hasCheckFinal) {
    estado = 'CERRADO';
  } else if (hasInforme && !hasCheckFinal) {
    estado = 'PENDIENTE_CIERRE';
  } else if (hasDocs && !hasInforme) {
    estado = 'EN_EVALUACION';
  } else if (hasDocs) {
    estado = 'EN_PROCESO';
  } else {
    estado = 'POR_INICIAR';
  }

  // Riesgo basado en plazo máximo
  if (estado !== 'CERRADO' && diasParaPlazo !== null) {
    if (diasParaPlazo <= 0) estado = 'EN_RIESGO';     // plazo vencido
    else if (diasParaPlazo <= 5) estado = 'EN_RIESGO'; // quedan 5 días o menos
  }

  return estado;
}

export async function handler(_req: Request): Promise<Response> {
  try {
    const records = await fetchAllRecords(BASE_ID, TABLE_ID, FIELDS);
    const now = Date.now();

    const procesos = records
      .map(rec => {
        const f = rec.fields;
        const id = f['ID'] || '';
        const nombre = f['Nombre y Apellido'] || '';
        if (!id || !nombre) return null;

        const hasDocs = hasAttachments(f['Documentos']);
        const hasInforme = hasAttachments(f['Informe Psicolaboral']);
        const hasCheckFinal = !!f['CHECK FINAL'];
        const hasRespaldo = false; // No separate field in this table

        const fechaInicio = f['Fecha de Inicio'] || '';
        const fechaUltimoMov = f['Última modificación'] || '';
        const diasSinMov = fechaUltimoMov
          ? Math.floor((now - new Date(fechaUltimoMov).getTime()) / 86400000)
          : 0;
        const plazoMaximo = f['Plazo Máximo'] || '';
        const diasParaPlazo = plazoMaximo
          ? Math.floor((new Date(plazoMaximo).getTime() - now) / 86400000)
          : null;

        let progreso = 20;
        if (hasDocs) progreso += 25;
        if (hasRespaldo) progreso += 25;
        if (hasInforme) progreso += 20;
        if (hasCheckFinal) progreso += 10;

        return {
          id,
          cargo: f['Cargo'] || '',
          nombre: f['Nombre y Apellido'] || '',
          correo: f['Correo'] || '',
          rut: f['Rut'] || '',
          telefono: f['Teléfono'] || '',
          division: selectName(f['División']),
          categoria: selectName(f['Categoría']),
          documentos: '',
          documentos_count: attachmentCount(f['Documentos']),
          has_documentos: hasDocs,
          informe_psicolaboral: '',
          has_informe: hasInforme,
          respaldo_entrevista: '',
          has_respaldo: hasRespaldo,
          observacion_control: f['Observación Control'] || '',
          check_final: selectName(f['CHECK FINAL']),
          has_check_final: hasCheckFinal,
          estado_documental: hasDocs ? 'COMPLETO' : 'PENDIENTE',
          estado_evaluacion: hasInforme ? 'COMPLETA' : 'PENDIENTE',
          estado_entrevista: hasRespaldo ? 'COMPLETA' : 'PENDIENTE',
          estado_cierre: hasCheckFinal ? 'CERRADO' : 'PENDIENTE',
          estado_general: computeEstadoGeneral(hasDocs, hasInforme, hasCheckFinal, diasParaPlazo),
          progreso,
          dias_sin_movimiento: diasSinMov,
          fecha_inicio: fechaInicio,
          fecha_ultimo_movimiento: fechaUltimoMov,
          plazo_maximo: plazoMaximo,
          dias_para_plazo: diasParaPlazo,
          especialista: f['Especialista-1'] || '',
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify(procesos), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Vercel adapter
export default handler;

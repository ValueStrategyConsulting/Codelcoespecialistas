import { fetchAllRecords, selectName } from './lib/airtable';

const BASE_ID = 'apph3dXyQoZBhK8Zl';
const TABLE_ID = 'tblrHggmb2X86XVQl';

const FIELDS = [
  'fldC9Grpu0yNg4ILR', // Numero ID Del Proceso
  'fldvNCFnQhZxDqTlF', // Email
  'fldVRB9IC24V5MOWb', // Nombre y Apellido
  'fld0Llvnyk8ooOulN', // Fecha de evaluación
  'fld6aoYCskgvouu9O', // Categoría
  // Sellos Liderazgo (LIDER)
  'fldmcb9c8BdEUQ3w3', // Conecto con Propósito
  'fldent4H4e1v53wnY', // Integro Equipos
  'fld8Ok3Zu7umlehp9', // Desarrollo Personas
  'fldVey2oJDMKkFwfS', // Desafío ir más allá
  'fldtGaOtrhLVIZfF8', // Orientación seguridad
  // Sellos (PROF Y TACTICO)
  'fldxUtJYACb5DuQkA', // Conecto
  'fldALob3zSd64JtXu', // Integro
  'fldf1Cc5dWUSI3NTF', // Desarrollo
  'fldcJqBWw00OAqNjH', // Desafío
  'fld7XABbWlEXPpWOR', // Seguridad
  // Sellos (APREN Y OPE)
  'fld8azoQKzLE3wGrA', // Conecto
  'fldsG0iirPi1Wy0Ea', // Integro
  'fldLOuNorAjXKE6YF', // Desarrollo
  'flds0FXIs48XJyC8f', // Desafío
  'fldeCO5yHUHayErjG', // Seguridad
  // Valores
  'fldTovSnogWz8a898', // Nos cuidamos
  'fldztuMnjceiln9Ag', // Vivimos el respeto
  'fldholtTIo0uoL4yd', // Excelencia e innovación
  'fldwZmu3qN2PtZHWN', // Valoramos colaboración
  'fldxhM1dFMfUzIZNf', // Futuro sustentabilidad
  // Textos
  'fldQ0cji08Mfp4m3a', // Resumen General
  'fldJPnANt7M4hXLN1', // Motivación
  'fldP5tM72X8Z79v3v', // Educación
  'fldDQSi11HG2xlq8b', // Situación Actual
  'fldiApve1XVb6JbwU', // Nivel de Liderazgo
  'fldUZXpPk9TfieM2N', // Origen
  'fld6uxLzazqtTngLj', // Sello Liderazgo
];

export async function handler(_req: Request): Promise<Response> {
  try {
    const records = await fetchAllRecords(BASE_ID, TABLE_ID, FIELDS);

    const entries = records.map(rec => {
      const f = rec.fields;

      // Build sellos map — pick the set that has data (LIDER > PROF > APREN)
      const sellos: Record<string, number | null> = {};

      // Try LIDER first, then PROF, then APREN for each sello
      sellos['Conecto con Propósito'] = f['Notas (1-5)  Sello: Conecto con Propósito común (LIDER)']
        ?? f['Notas (1-5)  Sello: Conecto con Propósito común (PROF Y TACTICO)']
        ?? f['Notas (1-5)  Sello: Conecto con Propósito común (APREN Y OPE)']
        ?? null;
      sellos['Integro Equipos'] = f['Notas (1-5)  Sello: Integro Equipos de Trabajo (LIDER)']
        ?? f['Notas (1-5)  Sello: Integro Equipos de Trabajo (PROF Y TACTICO)']
        ?? f['Notas (1-5)  Sello: Integro Equipos de Trabajo (APREN Y OPE)']
        ?? null;
      sellos['Desarrollo Personas'] = f['Notas (1-5)  Sello: Desarrollo a las Personas (LIDER)']
        ?? f['Notas (1-5)  Sello: Desarrollo a las Personas (PROF Y TACTICO)']
        ?? f['Notas (1-5)  Sello: Desarrollo a las Personas (APREN Y OPE)']
        ?? null;
      sellos['Desafío ir más allá'] = f['Notas (1-5)  Sello: Desafío ir más allá (LIDER)']
        ?? f['Notas (1-5)  Sello: Desafío ir más allá (PROF Y TACTICO)']
        ?? f['Notas (1-5)  Sello: Desafío ir más allá (APREN Y OPE)']
        ?? null;
      sellos['Orientación Seguridad'] = f['Notas (1-5)  Sello: Orientación a la seguridad (LIDER)']
        ?? f['Notas (1-5)  Sello: Orientación a la seguridad (PROF Y TACTICO)']
        ?? f['Notas (1-5)  Sello: Orientación a la seguridad (APREN Y OPE)']
        ?? null;

      const valores: Record<string, number | null> = {
        'Nos cuidamos': f['Nos cuidamos'] ?? null,
        'Vivimos el respeto': f['Vivimos el respeto'] ?? null,
        'Excelencia e innovación': f['Cumplimos con excelencia e innovación'] ?? null,
        'Valoramos colaboración': f['Valoramos la colaboración'] ?? null,
        'Futuro sustentabilidad': f['Construimos el futuro con sustentabilidad'] ?? null,
      };

      return {
        id_proceso: f['Numero ID Del Proceso'] ? String(f['Numero ID Del Proceso']) : '',
        email: f['Email'] || '',
        nombre: f['Nombre y Apellido del Candidato'] || '',
        fecha_evaluacion: f['Fecha de evaluación'] || '',
        categoria: selectName(f['Categoría']),
        nivel_liderazgo: selectName(f['Nivel de Liderazgo']),
        sello_liderazgo: selectName(f['Sello Liderazgo']),
        origen: selectName(f['Origen']),
        educacion: f['Educación'] || '',
        situacion_actual: f['Situación Actual'] || '',
        resumen: f['Resumen General'] || '',
        motivacion: f['Motivación'] || '',
        sellos,
        valores,
      };
    });

    return new Response(JSON.stringify(entries), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default handler;

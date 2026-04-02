import { fetchAllRecords, selectName } from './lib/airtable';

const BASE_ID = 'appH4ByfDsfJFEp0l';
const TABLE_ID = 'tbl6DF4OefBQ0fj35';

const FIELDS = [
  'fldedcg5veTSOlfnU', // ID
  'fldRW5HClyKhNN70m', // Ingreso (date)
  'fldY9GmKqU0d0uJsI', // Especialista (singleSelect)
  'fldbgawg5FCQ3uony', // Evaluación Informes Psicolaborales (singleSelect)
  'fldXqIz9j6eIE1fuG', // Puntaje Informes Psicolaborales (formula)
  'fldGZbTVdDI7rMplW', // Observaciones positivas psicolaborales
  'fldGo96Ipw0xng3sc', // Oportunidades Psicolaborales
  'fldPvwO1zLmB6fdYL', // Evaluación Documentos (singleSelect)
  'fldcWDi3VkPofs4q2', // Puntaje Documentos (formula)
  'fldM6TEyXaO6BGHFz', // Fortalezas Documentos
  'fldLeE90Zxw8liiQF', // Oportunidades Documentos
];

export async function handler(_req: Request): Promise<Response> {
  try {
    const records = await fetchAllRecords(BASE_ID, TABLE_ID, FIELDS);

    const encuestas = records.map(rec => {
      const f = rec.fields;
      return {
        id: f['ID'] || '',
        fecha_ingreso: f['Ingreso'] || '',
        especialista: selectName(f['Especialista']),
        eval_informes: selectName(f['Evaluación Informes Psicolaborales']),
        puntaje_informes: f['Puntaje Informes Psicolaborales'] ?? null,
        obs_positivas_psico: f['Observaciones positivas psicolaborales '] || '',
        oportunidades_psico: f['Oportunidades Psicolaborales '] || '',
        eval_documentos: selectName(f['Evaluación Documentos']),
        puntaje_documentos: f['Puntaje Documentos'] ?? null,
        fortalezas_docs: f['Fortalezas Documentos'] || '',
        oportunidades_docs: f['Oportunidades Documentos'] || '',
      };
    });

    return new Response(JSON.stringify(encuestas), {
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

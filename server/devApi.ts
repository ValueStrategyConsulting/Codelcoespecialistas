// Vite dev server middleware — proxies /api/* to Airtable
// Only used in development. In production, use serverless functions.

import type { Plugin } from 'vite';

const AIRTABLE_API = 'https://api.airtable.com/v0';

async function fetchAllRecords(token: string, baseId: string, tableId: string, fieldIds?: string[]) {
  const allRecords: any[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (fieldIds) fieldIds.forEach(id => params.append('fields[]', id));
    if (offset) params.set('offset', offset);
    params.set('pageSize', '100');

    const resp = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) throw new Error(`Airtable ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function selectName(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.name || '';
}

function hasAttachments(field: any): boolean {
  return Array.isArray(field) && field.length > 0;
}

function computeEstadoGeneral(hasDocs: boolean, hasInforme: boolean, hasCheck: boolean, diasParaPlazo: number | null): string {
  let e = 'POR_INICIAR';
  if (hasCheck) e = 'CERRADO';
  else if (hasInforme) e = 'PENDIENTE_CIERRE';
  else if (hasDocs && !hasInforme) e = 'EN_EVALUACION';
  else if (hasDocs) e = 'EN_PROCESO';

  // Riesgo basado en plazo máximo
  if (e !== 'CERRADO' && diasParaPlazo !== null) {
    if (diasParaPlazo <= 0) e = 'EN_RIESGO';       // plazo vencido
    else if (diasParaPlazo <= 5) e = 'EN_RIESGO';   // quedan 5 días o menos
  }
  return e;
}

// Cache to avoid re-fetching on every request during dev
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      // Load env manually since Vite only exposes VITE_ prefixed vars to client
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(server.config.root, '.env.local');
      let envToken = '';
      try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/AIRTABLE_PAT=(.+)/);
        if (match) envToken = match[1].trim();
      } catch {}
      const token = process.env.AIRTABLE_PAT || envToken || '';

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        if (!token) {
          // Fallback to static JSON if no token
          return next();
        }

        const endpoint = req.url.replace('/api/', '');
        res.setHeader('Content-Type', 'application/json');

        try {
          if (endpoint === 'procesos') {
            let data = getCached('procesos');
            if (!data) {
              const records = await fetchAllRecords(token, 'appH4ByfDsfJFEp0l', 'tblwulQitACgXEdya');
              const now = Date.now();
              data = records.map((rec: any) => {
                const f = rec.fields;
                const hasDocs = hasAttachments(f['Documentos']);
                const hasInforme = hasAttachments(f['Informe Psicolaboral']);
                const hasCheck = !!f['CHECK FINAL'];
                const fechaMov = f['Última modificación'] || '';
                const diasSinMov = fechaMov ? Math.floor((now - new Date(fechaMov).getTime()) / 86400000) : 0;
                const plazoMaximo = f['Plazo Máximo'] || '';
                const diasParaPlazo = plazoMaximo ? Math.floor((new Date(plazoMaximo).getTime() - now) / 86400000) : null;
                let progreso = 20;
                if (hasDocs) progreso += 25;
                if (hasInforme) progreso += 20;
                if (hasCheck) progreso += 10;
                return {
                  id: f['ID'] || '', cargo: f['Cargo'] || '', nombre: f['Nombre y Apellido'] || '',
                  correo: f['Correo'] || '', rut: f['Rut'] || '', telefono: f['Teléfono'] || '',
                  division: selectName(f['División']), categoria: selectName(f['Categoría']),
                  documentos: '', documentos_count: Array.isArray(f['Documentos']) ? f['Documentos'].length : 0,
                  has_documentos: hasDocs, informe_psicolaboral: '', has_informe: hasInforme,
                  respaldo_entrevista: '', has_respaldo: false,
                  observacion_control: f['Observación Control'] || '',
                  check_final: selectName(f['CHECK FINAL']), has_check_final: hasCheck,
                  estado_documental: hasDocs ? 'COMPLETO' : 'PENDIENTE',
                  estado_evaluacion: hasInforme ? 'COMPLETA' : 'PENDIENTE',
                  estado_entrevista: 'PENDIENTE', estado_cierre: hasCheck ? 'CERRADO' : 'PENDIENTE',
                  estado_general: computeEstadoGeneral(hasDocs, hasInforme, hasCheck, diasParaPlazo),
                  progreso, dias_sin_movimiento: diasSinMov,
                  fecha_inicio: f['Fecha de Inicio'] || '',
                  fecha_ultimo_movimiento: fechaMov,
                  plazo_maximo: plazoMaximo,
                  dias_para_plazo: diasParaPlazo,
                  especialista: f['Especialista-1'] || '',
                };
              }).filter((p: any) => p.id && p.nombre);
              setCache('procesos', data);
            }
            res.end(JSON.stringify(data));
          } else if (endpoint === 'encuestas') {
            let data = getCached('encuestas');
            if (!data) {
              const records = await fetchAllRecords(token, 'appH4ByfDsfJFEp0l', 'tbl6DF4OefBQ0fj35');
              data = records.map((rec: any) => {
                const f = rec.fields;
                return {
                  id: f['ID'] || '', fecha_ingreso: f['Ingreso'] || '',
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
              setCache('encuestas', data);
            }
            res.end(JSON.stringify(data));
          } else if (endpoint === 'onepage') {
            let data = getCached('onepage');
            if (!data) {
              const records = await fetchAllRecords(token, 'apph3dXyQoZBhK8Zl', 'tblrHggmb2X86XVQl');
              data = records.map((rec: any) => {
                const f = rec.fields;
                const sello = (lider: string, prof: string, apren: string) =>
                  f[lider] ?? f[prof] ?? f[apren] ?? null;
                return {
                  id_proceso: f['Numero ID Del Proceso'] ? String(f['Numero ID Del Proceso']) : '',
                  email: f['Email'] || '', nombre: f['Nombre y Apellido del Candidato'] || '',
                  fecha_evaluacion: f['Fecha de evaluación'] || '',
                  categoria: selectName(f['Categoría']),
                  resumen: f['Resumen General'] || '', motivacion: f['Motivación'] || '',
                  sellos: {
                    'Conecto con Propósito': sello('Notas (1-5)  Sello: Conecto con Propósito común (LIDER)', 'Notas (1-5)  Sello: Conecto con Propósito común (PROF Y TACTICO)', 'Notas (1-5)  Sello: Conecto con Propósito común (APREN Y OPE)'),
                    'Integro Equipos': sello('Notas (1-5)  Sello: Integro Equipos de Trabajo (LIDER)', 'Notas (1-5)  Sello: Integro Equipos de Trabajo (PROF Y TACTICO)', 'Notas (1-5)  Sello: Integro Equipos de Trabajo (APREN Y OPE)'),
                    'Desarrollo Personas': sello('Notas (1-5)  Sello: Desarrollo a las Personas (LIDER)', 'Notas (1-5)  Sello: Desarrollo a las Personas (PROF Y TACTICO)', 'Notas (1-5)  Sello: Desarrollo a las Personas (APREN Y OPE)'),
                    'Desafío ir más allá': sello('Notas (1-5)  Sello: Desafío ir más allá (LIDER)', 'Notas (1-5)  Sello: Desafío ir más allá (PROF Y TACTICO)', 'Notas (1-5)  Sello: Desafío ir más allá (APREN Y OPE)'),
                    'Orientación Seguridad': sello('Notas (1-5)  Sello: Orientación a la seguridad (LIDER)', 'Notas (1-5)  Sello: Orientación a la seguridad (PROF Y TACTICO)', 'Notas (1-5)  Sello: Orientación a la seguridad (APREN Y OPE)'),
                  },
                  valores: {
                    'Nos cuidamos': f['Nos cuidamos'] ?? null,
                    'Vivimos el respeto': f['Vivimos el respeto'] ?? null,
                    'Excelencia e innovación': f['Cumplimos con excelencia e innovación'] ?? null,
                    'Valoramos colaboración': f['Valoramos la colaboración'] ?? null,
                    'Futuro sustentabilidad': f['Construimos el futuro con sustentabilidad'] ?? null,
                  },
                };
              });
              setCache('onepage', data);
            }
            res.end(JSON.stringify(data));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
          }
        } catch (err: any) {
          console.error('[dev-api]', err.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

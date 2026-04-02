const fs = require('fs');
const path = require('path');

const CSV_PATH = 'G:/Unidades compartidas/VSC Team/VSC CHILE/03. PRODUCT/ATS CODELCO/Procesos_Asignados-VSC.csv';
const OUT_PATH = path.resolve(__dirname, '../public/data/procesos.json');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += line[i]; }
  }
  result.push(current);
  return result;
}

// Headers: ID(0), Cargo(1), Nombre y Apellido(2), Correo(3), Teléfono(4), Rut(5),
//          División(6), Categoría(7), Documentos(8), Informe Psicolaboral(9),
//          Observación Control(10), CHECK FINAL(11), Respaldo entrevista(12)

const ESPECIALISTAS = [
  'María José Contreras', 'Felipe Araya Muñoz', 'Carolina Pizarro Soto',
  'Andrés Valenzuela Reyes', 'Daniela Galarce', 'Javiera Hernández Lagos',
  'Constanza López Bravo', 'Rodrigo Fuentes Díaz', 'Valentina Torres Ruiz',
  'Catalina Silva Morales', 'Francisca Reyes Tapia', 'Macarena Díaz Olivares',
  'Ignacio Mendoza Castro', 'Camila Rojas Vega', 'Sebastián Núñez Parra',
];

function seededRandom(seed) {
  let s = Math.abs(seed) || 1;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const raw = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, '');
const lines = raw.split('\n').filter(l => l.trim());

const procesos = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const id = cols[0]?.trim();
  if (!id || !/^\d+$/.test(id)) continue;

  const nombre = cols[2]?.trim();
  if (!nombre) continue;

  const cargo = cols[1]?.trim() || '';
  const correo = cols[3]?.trim() || '';
  const telefono = cols[4]?.trim() || '';
  const rut = cols[5]?.trim() || '';
  const division = cols[6]?.trim() || '';
  const categoria = cols[7]?.trim() || '';
  const docsRaw = cols[8]?.trim() || '';
  const informeRaw = cols[9]?.trim() || '';
  const observacion = cols[10]?.trim() || '';
  const checkFinalRaw = cols[11]?.trim() || '';
  const respaldoRaw = cols[12]?.trim() || '';

  // Boolean fields
  const hasDocumentos = docsRaw.length > 0 && docsRaw.includes('.pdf');
  const hasInforme = informeRaw.length > 0;
  const hasRespaldo = respaldoRaw.length > 0 && respaldoRaw.includes('.pdf');
  const hasCheckFinal = checkFinalRaw.length > 0;
  const docCount = (docsRaw.match(/\.pdf/gi) || []).length;

  // Derived states
  const estado_documental = hasDocumentos ? 'COMPLETO' : 'PENDIENTE';
  const estado_evaluacion = hasInforme ? 'COMPLETA' : 'PENDIENTE';
  const estado_entrevista = hasRespaldo ? 'COMPLETA' : 'PENDIENTE';
  const estado_cierre = hasCheckFinal ? 'CERRADO' : 'PENDIENTE';

  // estado_general
  let estado_general;
  if (hasCheckFinal) {
    estado_general = 'CERRADO';
  } else if (hasInforme && !hasCheckFinal) {
    estado_general = 'PENDIENTE_CIERRE';
  } else if (hasDocumentos && hasRespaldo && !hasInforme) {
    estado_general = 'EN_EVALUACION';
  } else if (hasDocumentos) {
    estado_general = 'EN_PROCESO';
  } else {
    estado_general = 'POR_INICIAR';
  }

  // Risk override
  const rng = seededRandom(parseInt(id) + i);
  const especialista = ESPECIALISTAS[Math.floor(rng() * ESPECIALISTAS.length)];

  // Generate dates
  const startBase = new Date('2024-03-01').getTime();
  const startRange = new Date('2025-12-01').getTime() - startBase;
  const fechaInicio = new Date(startBase + rng() * startRange).toISOString().split('T')[0];
  const diasProceso = Math.floor(rng() * 180) + 1;
  const fechaUltimoMov = new Date(new Date(fechaInicio).getTime() + diasProceso * 86400000);
  const hoy = new Date();
  const fechaUltimoMovimiento = (fechaUltimoMov > hoy ? hoy : fechaUltimoMov).toISOString().split('T')[0];

  const diasSinMovimiento = Math.floor((hoy.getTime() - new Date(fechaUltimoMovimiento).getTime()) / 86400000);
  // Simular plazo máximo: desde hoy -30 a +60 días para distribución realista
  const diasOffsetPlazo = Math.floor(rng() * 90) - 30;
  const plazoMaximo = new Date(hoy.getTime() + diasOffsetPlazo * 86400000).toISOString().split('T')[0];
  const diasParaPlazo = diasOffsetPlazo;

  // Riesgo basado en plazo máximo
  if (estado_general !== 'CERRADO' && diasParaPlazo <= 5) {
    estado_general = 'EN_RIESGO';
  }

  // Progress engine (0-100)
  let progreso = 20; // base: record exists
  if (hasDocumentos) progreso += 25;
  if (hasRespaldo) progreso += 25;
  if (hasInforme) progreso += 20;
  if (hasCheckFinal) progreso += 10;

  procesos.push({
    id,
    cargo,
    nombre,
    correo,
    telefono,
    rut,
    division,
    categoria,
    documentos: docsRaw,
    documentos_count: docCount,
    has_documentos: hasDocumentos,
    informe_psicolaboral: informeRaw,
    has_informe: hasInforme,
    respaldo_entrevista: respaldoRaw,
    has_respaldo: hasRespaldo,
    observacion_control: observacion,
    check_final: checkFinalRaw,
    has_check_final: hasCheckFinal,
    estado_documental,
    estado_evaluacion,
    estado_entrevista,
    estado_cierre,
    estado_general,
    progreso,
    dias_sin_movimiento: diasSinMovimiento,
    fecha_inicio: fechaInicio,
    fecha_ultimo_movimiento: fechaUltimoMovimiento,
    plazo_maximo: plazoMaximo,
    dias_para_plazo: diasParaPlazo,
    especialista,
  });
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(procesos, null, 2), 'utf-8');

// Stats
const divs = new Set(procesos.map(p => p.division).filter(Boolean));
const estados = {};
procesos.forEach(p => { estados[p.estado_general] = (estados[p.estado_general] || 0) + 1; });
console.log(`Generated ${procesos.length} records`);
console.log(`Divisiones: ${[...divs].sort().join(', ')}`);
console.log('Estados:', estados);
console.log(`Avg progress: ${Math.round(procesos.reduce((s, p) => s + p.progreso, 0) / procesos.length)}%`);

import type { Encuesta, TipoEncuesta } from '../types';

const ESPECIALISTAS = [
  'María José Contreras',
  'Felipe Araya Muñoz',
  'Carolina Pizarro Soto',
  'Andrés Valenzuela Reyes',
  'Daniela Galarce',
  'Javiera Hernández Lagos',
  'Constanza López Bravo',
  'Rodrigo Fuentes Díaz',
  'Valentina Torres Ruiz',
  'Catalina Silva Morales',
  'Francisca Reyes Tapia',
  'Macarena Díaz Olivares',
  'Ignacio Mendoza Castro',
  'Camila Rojas Vega',
  'Sebastián Núñez Parra',
];

const MESES = ['2026-01', '2026-02', '2026-03'];
const TIPOS: TipoEncuesta[] = ['Filtros', 'CRS', 'Examenes'];

function seededRandom(seed: number) {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateMockData(): Encuesta[] {
  const data: Encuesta[] = [];
  let seedIdx = 0;

  for (const mes of MESES) {
    for (const tipo of TIPOS) {
      for (const especialista of ESPECIALISTAS) {
        seedIdx++;
        const rng = seededRandom(seedIdx * 31 + mes.charCodeAt(5));
        const total = Math.floor(rng() * 30) + 5;
        const contestadas = Math.floor(rng() * total * 0.95) + Math.floor(total * 0.3);
        const capped = Math.min(contestadas, total);
        const no_contestadas = total - capped;
        const porcentaje = Math.round((capped / total) * 100);

        data.push({
          mes,
          tipo_encuesta: tipo,
          especialista,
          contestadas: capped,
          no_contestadas,
          total_enviadas: total,
          porcentaje,
        });
      }
    }
  }

  return data;
}

let cache: Encuesta[] | null = null;

export const encuestasService = {
  getEncuestas(): Encuesta[] {
    if (!cache) cache = generateMockData();
    return cache;
  },

  filterEncuestas(mes?: string, tipo?: string): Encuesta[] {
    let data = this.getEncuestas();
    if (mes) data = data.filter(e => e.mes === mes);
    if (tipo) data = data.filter(e => e.tipo_encuesta === tipo);
    return data;
  },

  getMeses(): string[] {
    return MESES;
  },

  getTipos(): TipoEncuesta[] {
    return TIPOS;
  },
};

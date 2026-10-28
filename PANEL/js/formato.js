/**
 * Números, tamaños y fechas como se leen en Uruguay. Las fechas, siempre en
 * la hora de Montevideo. Funciones puras: las prueba pruebas/datos.test.mjs.
 */

const ZONA = 'America/Montevideo';

const enteros = new Intl.NumberFormat('es-UY');
const unDecimal = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 });
const conHora = new Intl.DateTimeFormat('es-UY', {
  dateStyle: 'short',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: ZONA,
});
const soloFecha = new Intl.DateTimeFormat('es-UY', { dateStyle: 'long', timeZone: ZONA });
// Los días de por_dia ya son días de Montevideo: se leen a mediodía en UTC.
const diaDeLaSemana = new Intl.DateTimeFormat('es-UY', { weekday: 'long', timeZone: 'UTC' });

export const numero = (n) => enteros.format(n);

/** Bytes en unidades decimales (kB, MB, GB), como el plan de Supabase. */
export function bytes(n) {
  if (n < 1000) return `${enteros.format(n)} B`;
  const unidades = ['kB', 'MB', 'GB', 'TB'];
  let valor = n / 1000;
  let i = 0;
  while (valor >= 1000 && i < unidades.length - 1) {
    valor /= 1000;
    i += 1;
  }
  return `${unDecimal.format(valor)} ${unidades[i]}`;
}

/** El porcentaje de uso, de 0 a 100, con un decimal. */
export const porcentaje = (usado, limite) =>
  `${unDecimal.format(Math.min(100, (usado / limite) * 100))} %`;

export const fechaYHora = (ms) => conHora.format(ms);
export const fecha = (ms) => soloFecha.format(ms);
export const diaDeSemana = (dia) => diaDeLaSemana.format(Date.parse(`${dia}T12:00:00Z`));

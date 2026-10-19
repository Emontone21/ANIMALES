import { t } from '@/i18n/es-UY';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const SEMANA = 7 * DIA;

/** "hace 3 horas", "ayer", "hace 2 semanas". */
export function haceCuanto(fecha: string | Date, ahora: Date = new Date()): string {
  const momento = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const diff = Math.max(0, ahora.getTime() - momento.getTime());

  if (diff < MINUTO) return t.fechas.ahora;
  if (diff < HORA) return t.fechas.haceMinutos(Math.floor(diff / MINUTO));
  if (diff < DIA) return t.fechas.haceHoras(Math.floor(diff / HORA));
  if (diff < SEMANA) return t.fechas.haceDias(Math.floor(diff / DIA));
  return t.fechas.haceSemanas(Math.floor(diff / SEMANA));
}

/** "17/10/2026 14:05" en horario de Uruguay. */
export function fechaHoraCorta(fecha: string | Date): string {
  const momento = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Montevideo',
  }).format(momento);
}

const ZONA = 'America/Montevideo';
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });
const formatoHora = new Intl.DateTimeFormat('es-UY', {
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONA,
});
const formatoDiaCorto = new Intl.DateTimeFormat('es-UY', {
  day: 'numeric',
  month: 'numeric',
  timeZone: ZONA,
});

/** "Hoy a las 9:40", "Ayer a las 18:05" o "17/10 a las 9:40", en horario de Uruguay. */
export function diaYHora(fecha: string | Date, ahora: Date = new Date()): string {
  const momento = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const hora = formatoHora.format(momento);
  const dia = formatoDia.format(momento);
  if (dia === formatoDia.format(ahora)) return t.fechas.hoyALas(hora);
  if (dia === formatoDia.format(new Date(ahora.getTime() - DIA))) return t.fechas.ayerALas(hora);
  return t.fechas.diaALas(formatoDiaCorto.format(momento), hora);
}

const formatoDiaSemana = new Intl.DateTimeFormat('es-UY', { weekday: 'long', timeZone: ZONA });
const formatoNumeroDia = new Intl.DateTimeFormat('es-UY', { day: 'numeric', timeZone: ZONA });
const formatoMes = new Intl.DateTimeFormat('es-UY', { month: 'long', timeZone: ZONA });

/**
 * Para "Perdido desde…": "hoy", "ayer", "el sábado 17" en la última semana y
 * "el 3 de octubre" antes, en horario de Uruguay.
 */
export function desdeCuando(fecha: string | Date, ahora: Date = new Date()): string {
  const momento = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const dia = formatoDia.format(momento);
  if (dia === formatoDia.format(ahora)) return t.fechas.hoy;
  if (dia === formatoDia.format(new Date(ahora.getTime() - DIA))) return t.fechas.ayer;
  const numero = formatoNumeroDia.format(momento);
  if (ahora.getTime() - momento.getTime() < 6 * DIA) {
    return t.fechas.elDiaDeLaSemana(minuscula(formatoDiaSemana.format(momento)), numero);
  }
  return t.fechas.elDiaDelMes(numero, minuscula(formatoMes.format(momento)));
}

// Algunos motores devuelven "Octubre" o "Sábado"; en español van en minúscula.
function minuscula(texto: string): string {
  return texto.toLocaleLowerCase('es-UY');
}

const formatoMesUtc = new Intl.DateTimeFormat('es-UY', { month: 'long', timeZone: 'UTC' });

/** "2026-10-19" → "19 de octubre de 2026" (para versiones de documentos, sin hora). */
export function fechaLarga(isoDia: string): string {
  const [anio, mes, dia] = isoDia.split('-').map(Number);
  if (!anio || !mes || !dia) return isoDia;
  const momento = new Date(Date.UTC(anio, mes - 1, dia));
  return t.fechas.fechaLarga(String(dia), minuscula(formatoMesUtc.format(momento)), String(anio));
}

/** Fecha N horas antes de ahora. */
export function hace(horas: number, ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - horas * HORA);
}

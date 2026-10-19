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

/** Fecha N horas antes de ahora. */
export function hace(horas: number, ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - horas * HORA);
}

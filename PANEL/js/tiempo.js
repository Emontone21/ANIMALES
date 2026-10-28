import { t } from '../i18n/es-UY.js';

const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;

/** "recién", "hace 4 min", "hace 2 h" o "hace 3 días", desde un momento en milisegundos. */
export function haceCuanto(desde, ahora = Date.now()) {
  const minutos = Math.floor(Math.max(0, ahora - desde) / MINUTO);
  if (minutos < 1) return t.tiempo.recien;
  if (minutos < 60) return t.tiempo.minutos(minutos);
  if (minutos < 48 * 60) return t.tiempo.horas(Math.floor(minutos / 60));
  return t.tiempo.dias(Math.floor(minutos / (24 * 60)));
}

/** Días enteros que faltan hasta un momento (0 si es hoy o ya pasó). */
export function diasHasta(hasta, ahora = Date.now()) {
  return Math.max(0, Math.floor((hasta - ahora) / DIA));
}

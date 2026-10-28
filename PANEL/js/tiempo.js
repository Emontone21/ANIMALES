import { t } from '../i18n/es-UY.js';

/** "recién", "hace 4 min" o "hace 2 h", desde un momento en milisegundos. */
export function haceCuanto(desde, ahora = Date.now()) {
  const minutos = Math.floor(Math.max(0, ahora - desde) / 60000);
  if (minutos < 1) return t.tiempo.recien;
  if (minutos < 60) return t.tiempo.minutos(minutos);
  return t.tiempo.horas(Math.floor(minutos / 60));
}

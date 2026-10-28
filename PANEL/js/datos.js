/**
 * Lo que llega del servidor y de Supabase Auth, revisado antes de usarlo.
 * Funciones puras (sin DOM): las prueba pruebas/datos.test.mjs.
 */

import { PARTES, TARJETAS } from './catalogo.js';

export const ESTADOS = ['ok', 'atencion', 'falla', 'pendiente', 'sinConfigurar'];

const VARIABLE = /^[A-Z][A-Z0-9_]{1,63}$/;
const URL_SUPABASE = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const PROMPTS = ['datosInternos', 'vercelVision', 'meta', 'linkedin', 'alertas'];
const MOTIVOS = ['adminInvalidos'];

const variables = (lista) =>
  Array.isArray(lista) ? lista.filter((n) => typeof n === 'string' && VARIABLE.test(n)) : [];

/** /api/config: si se puede entrar y, si no, qué variables faltan o no sirven. */
export function normalizarConfig(respuesta) {
  const r = respuesta && typeof respuesta === 'object' ? respuesta : {};
  const s = r.supabase;
  const supabase =
    s &&
    typeof s.url === 'string' &&
    URL_SUPABASE.test(s.url) &&
    typeof s.clavePublica === 'string' &&
    s.clavePublica.length > 0
      ? { url: s.url, clavePublica: s.clavePublica }
      : null;
  return { supabase, faltan: variables(r.faltan), invalidas: variables(r.invalidas) };
}

/** Cuando el servidor no mandó el estado de algo que el panel muestra. */
const SIN_ESTADO = Object.freeze({
  estado: 'falla',
  faltan: [],
  invalidas: [],
  prompt: null,
  migracion: false,
  motivo: 'sinEstado',
});

function normalizarItem(crudo) {
  if (!crudo || typeof crudo !== 'object' || !ESTADOS.includes(crudo.estado)) return null;
  return {
    estado: crudo.estado,
    faltan: variables(crudo.faltan),
    invalidas: variables(crudo.invalidas),
    prompt: PROMPTS.includes(crudo.prompt) ? crudo.prompt : null,
    migracion: crudo.migracion === true,
    motivo: MOTIVOS.includes(crudo.motivo) ? crudo.motivo : null,
  };
}

function porId(lista, ids) {
  const recibidos = new Map();
  for (const crudo of Array.isArray(lista) ? lista : []) {
    if (crudo && typeof crudo.id === 'string' && ids.includes(crudo.id)) {
      const item = normalizarItem(crudo);
      if (item) recibidos.set(crudo.id, item);
    }
  }
  return new Map(ids.map((id) => [id, recibidos.get(id) ?? SIN_ESTADO]));
}

/** /api/estado: un estado por cada parte y tarjeta que conoce el panel. */
export function normalizarEstado(respuesta) {
  const r = respuesta && typeof respuesta === 'object' ? respuesta : {};
  const fecha = typeof r.generadoEn === 'string' ? Date.parse(r.generadoEn) : NaN;
  return {
    generadoEn: Number.isFinite(fecha) ? fecha : null,
    partes: porId(r.partes, PARTES),
    tarjetas: porId(r.tarjetas, TARJETAS),
  };
}

/**
 * "Necesita atención": las fallas primero y después las de Atención, en el
 * orden en que aparecen en el panel. Lo pendiente o sin configurar no va acá:
 * va en "Configuración del panel". Una tarjeta que falla por una variable que
 * no sirve tampoco: ya la avisa la parte de la configuración que la tiene.
 */
export function avisosDe(estado) {
  const todos = [
    ...[...estado.partes].map(([id, item]) => ({ tipo: 'parte', id, ...item })),
    ...[...estado.tarjetas]
      .filter(([, item]) => item.invalidas.length === 0)
      .map(([id, item]) => ({ tipo: 'tarjeta', id, ...item })),
  ];
  return [
    ...todos.filter((a) => a.estado === 'falla'),
    ...todos.filter((a) => a.estado === 'atencion'),
  ];
}

export function resumenDe(avisos) {
  return {
    fallas: avisos.filter((a) => a.estado === 'falla').length,
    atenciones: avisos.filter((a) => a.estado === 'atencion').length,
  };
}

/** Mientras alguna parte no esté lista, el Inicio muestra "Configuración del panel". */
export function faltaConfigurar(estado) {
  return [...estado.partes.values()].some((item) => item.estado !== 'ok');
}

/**
 * El error de Supabase Auth al entrar, como código de `t.ingreso.errores`.
 * Nunca se muestra el mensaje en inglés que trae.
 */
export function codigoDeErrorDeIngreso(error) {
  const codigo = typeof error?.code === 'string' ? error.code : '';
  const estado = typeof error?.status === 'number' ? error.status : null;
  if (codigo === 'invalid_credentials') return 'credenciales';
  if (codigo === 'email_not_confirmed') return 'emailSinConfirmar';
  if (codigo === 'captcha_failed') return 'captcha';
  if (estado === 429 || codigo.startsWith('over_')) return 'muchosIntentos';
  if (error?.name === 'AuthRetryableFetchError' || estado === 0) return 'red';
  if (estado === 400) return 'credenciales';
  return 'otro';
}

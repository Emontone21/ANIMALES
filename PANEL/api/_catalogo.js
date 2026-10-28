/**
 * Qué necesita cada parte del panel y cada tarjeta, y en qué estado queda.
 * Los ids son los mismos de js/catalogo.js (lo comprueba
 * pruebas/catalogo.test.mjs). En esta etapa ninguna tarjeta tiene datos: el
 * estado dice qué falta (una variable) o qué prompt la completa.
 *
 * - `requiere`: variables sin las que la tarjeta no puede tener datos.
 * - `enlaces`: variables solo para su link "Abrir en…".
 * - `prompt`: el prompt que trae los datos (DISEÑO.md, "Plan de los prompts").
 * - `migracion`: necesita la migración de administradores
 *   (propuestas/migracion-admin.sql).
 */

import { estadoDeVariable } from './_comun.js';

export const ENLACES = [
  'LINK_APP_URL',
  'LINK_VERCEL_TEAM',
  'LINK_VERCEL_PROJECT',
  'LINK_FACEBOOK_URL',
  'LINK_INSTAGRAM_URL',
  'LINK_LINKEDIN_URL',
  'LINK_VISION_URL',
];

const VERCEL = ['VERCEL_API_TOKEN', 'LINK_VERCEL_TEAM', 'LINK_VERCEL_PROJECT'];

export const PARTES = [
  { id: 'ingreso', requiere: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ADMIN_USER_IDS'] },
  { id: 'enlaces', enlaces: ENLACES },
  { id: 'datosInternos', prompt: 'datosInternos', migracion: true },
  { id: 'vercel', requiere: VERCEL, prompt: 'vercelVision' },
  { id: 'vision', requiere: ['LINK_VISION_URL'], prompt: 'vercelVision' },
  {
    id: 'meta',
    requiere: ['META_ACCESS_TOKEN', 'META_PAGE_ID', 'META_IG_USER_ID'],
    prompt: 'meta',
  },
  { id: 'linkedin', requiere: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORG_ID'], prompt: 'linkedin' },
  { id: 'alertas', prompt: 'alertas' },
];

const DATOS_INTERNOS = { prompt: 'datosInternos', migracion: true };

export const TARJETAS = [
  { id: 'app.casosNuevos', ...DATOS_INTERNOS },
  { id: 'app.reunidos', ...DATOS_INTERNOS, enlaces: ['LINK_APP_URL'] },
  { id: 'app.coincidencias', ...DATOS_INTERNOS },
  { id: 'app.moderacion', ...DATOS_INTERNOS },
  { id: 'app.usuarios', ...DATOS_INTERNOS },
  { id: 'app.fotosTrabadas', ...DATOS_INTERNOS },
  { id: 'infra.vercel', requiere: VERCEL, prompt: 'vercelVision' },
  { id: 'infra.supabase', ...DATOS_INTERNOS },
  { id: 'infra.vision', requiere: ['LINK_VISION_URL'], prompt: 'vercelVision', migracion: true },
  {
    id: 'redes.facebook',
    requiere: ['META_ACCESS_TOKEN', 'META_PAGE_ID'],
    enlaces: ['LINK_FACEBOOK_URL'],
    prompt: 'meta',
  },
  {
    id: 'redes.instagram',
    requiere: ['META_ACCESS_TOKEN', 'META_IG_USER_ID'],
    enlaces: ['LINK_INSTAGRAM_URL'],
    prompt: 'meta',
  },
  {
    id: 'redes.linkedin',
    requiere: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORG_ID'],
    enlaces: ['LINK_LINKEDIN_URL'],
    prompt: 'linkedin',
  },
  { id: 'tokens.vercel', requiere: ['VERCEL_API_TOKEN'], prompt: 'vercelVision' },
  { id: 'tokens.meta', requiere: ['META_ACCESS_TOKEN'], prompt: 'meta' },
  { id: 'tokens.linkedin', requiere: ['LINKEDIN_ACCESS_TOKEN'], prompt: 'linkedin' },
];

/**
 * El estado de una parte o tarjeta según las variables:
 * - `falla`: alguna variable tiene un valor que no sirve;
 * - `sinConfigurar`: falta una que necesita para tener datos;
 * - `pendiente`: tiene lo suyo pero los datos llegan con un prompt;
 * - `ok`: no le falta nada (por ahora, solo `ingreso` y `enlaces`).
 */
export function estadoDe(item, env) {
  const requiere = item.requiere ?? [];
  const todas = [...new Set([...requiere, ...(item.enlaces ?? [])])];
  const faltan = todas.filter((n) => estadoDeVariable(env, n) === 'falta');
  const invalidas = todas.filter((n) => estadoDeVariable(env, n) === 'invalida');

  let estado;
  if (invalidas.length > 0) estado = 'falla';
  else if (requiere.some((n) => faltan.includes(n))) estado = 'sinConfigurar';
  else if (item.prompt) estado = 'pendiente';
  else estado = faltan.length > 0 ? 'sinConfigurar' : 'ok';

  return {
    id: item.id,
    estado,
    faltan,
    invalidas,
    prompt: item.prompt ?? null,
    migracion: item.migracion === true,
  };
}

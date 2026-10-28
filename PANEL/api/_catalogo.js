/**
 * Qué necesita cada parte del panel y cada tarjeta, y en qué estado queda
 * según las variables. Los ids son los mismos de js/catalogo.js (lo comprueba
 * pruebas/catalogo.test.mjs). Los datos y los umbrales están en _tarjetas.js.
 *
 * - `requiere`: variables sin las que la tarjeta no puede tener datos.
 * - `enlaces`: variables solo para su link "Abrir en…".
 * - `fuente`: de dónde salen sus datos: `resumen` (admin_resumen(), migración
 *   0028) o `vercel` (la API de Vercel).
 * - `prompt`: el prompt que todavía tiene que traer sus datos (DISEÑO.md,
 *   "Plan de los prompts").
 */

import { estadoDeVariable } from './_comun.js';

export const ENLACES = [
  'LINK_APP_URL',
  'LINK_VERCEL_TEAM',
  'LINK_VERCEL_PROJECT',
  'LINK_FACEBOOK_URL',
  'LINK_INSTAGRAM_URL',
  'LINK_LINKEDIN_URL',
];

const VERCEL = ['VERCEL_API_TOKEN', 'LINK_VERCEL_TEAM', 'LINK_VERCEL_PROJECT'];

export const PARTES = [
  { id: 'ingreso', requiere: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ADMIN_USER_IDS'] },
  { id: 'enlaces', enlaces: ENLACES },
  { id: 'datosInternos', fuente: 'resumen' },
  { id: 'vercel', requiere: VERCEL, fuente: 'vercel' },
  {
    id: 'meta',
    requiere: ['META_ACCESS_TOKEN', 'META_PAGE_ID', 'META_IG_USER_ID'],
    prompt: 'meta',
  },
  { id: 'linkedin', requiere: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORG_ID'], prompt: 'linkedin' },
  { id: 'alertas', prompt: 'alertas' },
];

const RESUMEN = { fuente: 'resumen' };

export const TARJETAS = [
  { id: 'app.casosNuevos', ...RESUMEN },
  { id: 'app.reunidos', ...RESUMEN, enlaces: ['LINK_APP_URL'] },
  { id: 'app.coincidencias', ...RESUMEN },
  { id: 'app.moderacion', ...RESUMEN },
  { id: 'app.usuarios', ...RESUMEN },
  { id: 'app.fotosTrabadas', ...RESUMEN },
  { id: 'infra.vercel', requiere: VERCEL, fuente: 'vercel' },
  { id: 'infra.supabase', ...RESUMEN },
  // El reconocimiento con IA (función reconocer, 0018): sale de la base.
  { id: 'infra.vision', ...RESUMEN },
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
  { id: 'tokens.vercel', requiere: ['VERCEL_API_TOKEN'], fuente: 'vercel' },
  { id: 'tokens.meta', requiere: ['META_ACCESS_TOKEN'], prompt: 'meta' },
  { id: 'tokens.linkedin', requiere: ['LINKEDIN_ACCESS_TOKEN'], prompt: 'linkedin' },
];

/**
 * El estado de una parte o tarjeta según las variables:
 * - `falla`: alguna variable tiene un valor que no sirve;
 * - `sinConfigurar`: falta una que necesita para tener datos;
 * - `pendiente`: tiene lo suyo pero los datos llegan con un prompt;
 * - `ok`: no le falta nada. Si tiene `fuente`, _tarjetas.js le pone los datos
 *   y el estado final.
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
  else if (item.fuente) estado = 'ok';
  else estado = faltan.length > 0 ? 'sinConfigurar' : 'ok';

  return {
    id: item.id,
    estado,
    faltan,
    invalidas,
    prompt: item.prompt ?? null,
    motivo: null,
    datos: null,
  };
}

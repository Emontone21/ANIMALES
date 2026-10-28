/**
 * GET /api/config: la configuración pública del panel.
 *
 * - Sin sesión: solo lo necesario para la pantalla de ingreso (la URL y la
 *   clave pública de Supabase, las mismas que ya tiene la app) y qué
 *   variables faltan para poder entrar, por nombre.
 * - Con una sesión de administración (`Authorization: Bearer …`): además, los
 *   datos no secretos para armar los links "Abrir en…". Con una sesión que no
 *   sirve, 401; con una cuenta que no está en ADMIN_USER_IDS, 403.
 *
 * Cada variable que sale de acá está nombrada una por una.
 */

import {
  json,
  leer,
  leerBase,
  origenHttps,
  esSlug,
  tokenDe,
  urlDeFacebook,
  urlDeInstagram,
  urlDeLinkedin,
  validarSesion,
} from './_comun.js';

function slug(valor) {
  return valor && esSlug(valor) ? valor : null;
}

export function enlacesDe(env, base) {
  return {
    supabaseRef: base.ref,
    appUrl: origenHttps(leer(env, 'LINK_APP_URL')),
    vercelEquipo: slug(leer(env, 'LINK_VERCEL_TEAM')),
    vercelProyecto: slug(leer(env, 'LINK_VERCEL_PROJECT')),
    facebookUrl: urlDeFacebook(leer(env, 'LINK_FACEBOOK_URL')),
    instagramUrl: urlDeInstagram(leer(env, 'LINK_INSTAGRAM_URL')),
    linkedinUrl: urlDeLinkedin(leer(env, 'LINK_LINKEDIN_URL')),
  };
}

export async function responderConfig(request, env, pedir = fetch) {
  const base = leerBase(env);
  const publica = {
    supabase: base.listo ? { url: base.url, clavePublica: base.clave } : null,
    faltan: base.faltan,
    invalidas: base.invalidas,
  };
  if (!request.headers.has('authorization')) return json(publica);
  if (!tokenDe(request)) return json({ error: 'sinSesion' }, 401);

  const sesion = await validarSesion(request, env, pedir);
  if (!sesion.ok) return json({ error: sesion.error }, sesion.estado);
  return json({ ...publica, enlaces: enlacesDe(env, sesion.base) });
}

export function GET(request) {
  return responderConfig(request, process.env);
}

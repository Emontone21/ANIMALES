/**
 * Lo que comparten las funciones del panel (api/config y api/estado). Vercel
 * no publica como función un archivo de api/ que empieza con "_".
 *
 * Reglas (PANEL/CLAUDE.md y DISEÑO.md, "Seguridad"):
 * - Las variables se leen de a una, por su nombre. Nunca por patrón.
 * - De un secreto solo se dice si está, falta o tiene una forma que no sirve:
 *   nunca su valor.
 * - Nada de la clave service_role ni de la secret (sb_secret_…), ni ahora ni
 *   después: `esClavePublica` las rechaza para que nunca lleguen al navegador.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const REF_SUPABASE = /^[a-z0-9]{20}$/;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const ID_NUMERICO = /^\d{3,30}$/;
const TOKEN_OPACO = /^[\x21-\x7e]{16,4096}$/;
const BEARER = /^Bearer ([A-Za-z0-9._~+/-]{20,8192}=*)$/;

const TIEMPO_MAXIMO_MS = 5000;

const HOSTS = {
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  linkedin: ['linkedin.com', 'www.linkedin.com'],
};

/** El valor de una variable, sin espacios alrededor; null si no está o está vacía. */
export function leer(env, nombre) {
  const valor = env[nombre];
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function url(valor) {
  try {
    const u = new URL(valor);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return u;
  } catch {
    return null;
  }
}

/** El ref de una URL `https://<ref>.supabase.co`; null si tiene otra forma. */
export function refDeSupabase(valor) {
  const u = valor ? url(valor) : null;
  if (!u || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) return null;
  const partes = u.hostname.split('.');
  if (partes.length !== 3 || partes[1] !== 'supabase' || partes[2] !== 'co') return null;
  return REF_SUPABASE.test(partes[0]) ? partes[0] : null;
}

function rolDeJwt(valor) {
  const partes = valor.split('.');
  if (partes.length !== 3) return null;
  try {
    const datos = JSON.parse(globalThis.Buffer.from(partes[1], 'base64url').toString('utf8'));
    return typeof datos?.role === 'string' ? datos.role : null;
  } catch {
    return null;
  }
}

/**
 * Solo la publishable (`sb_publishable_…`) o la anon legacy (un JWT con
 * `role: anon`). Cualquier otra cosa, incluida la secret o la service_role,
 * no sirve: esta clave se manda al navegador.
 */
export function esClavePublica(valor) {
  if (!valor) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(valor)) return true;
  if (valor.startsWith('sb_')) return false;
  return rolDeJwt(valor) === 'anon';
}

/** Los ids de ADMIN_USER_IDS (separados por comas) y cuántos no son ids. */
export function idsDeAdministracion(valor) {
  const entradas = (valor ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const validos = entradas.filter((id) => UUID.test(id));
  return { validos: new Set(validos), invalidos: entradas.length - validos.length };
}

/** El origen de una URL https (sin ruta): para LINK_APP_URL. */
export function origenHttps(valor) {
  const u = valor ? url(valor) : null;
  return u ? u.origin : null;
}

function urlDeHosts(valor, hosts) {
  const u = valor ? url(valor) : null;
  if (!u || !hosts.includes(u.hostname.toLowerCase())) return null;
  u.hash = '';
  return u.href;
}

export const urlDeFacebook = (valor) => urlDeHosts(valor, HOSTS.facebook);
export const urlDeInstagram = (valor) => urlDeHosts(valor, HOSTS.instagram);
export const urlDeLinkedin = (valor) => urlDeHosts(valor, HOSTS.linkedin);

export const esSlug = (valor) => SLUG.test(valor ?? '');

/**
 * Cómo se valida cada variable. Las de secretos solo miran la forma (sin
 * espacios, largo razonable): si es válido lo dice la API de cada servicio,
 * en el prompt que la integra.
 */
const VALIDAR = {
  SUPABASE_URL: (v) => refDeSupabase(v) !== null,
  SUPABASE_PUBLISHABLE_KEY: esClavePublica,
  ADMIN_USER_IDS: (v) => idsDeAdministracion(v).validos.size > 0,
  LINK_APP_URL: (v) => origenHttps(v) !== null,
  LINK_VERCEL_TEAM: esSlug,
  LINK_VERCEL_PROJECT: esSlug,
  LINK_FACEBOOK_URL: (v) => urlDeFacebook(v) !== null,
  LINK_INSTAGRAM_URL: (v) => urlDeInstagram(v) !== null,
  LINK_LINKEDIN_URL: (v) => urlDeLinkedin(v) !== null,
  VERCEL_API_TOKEN: (v) => TOKEN_OPACO.test(v),
  META_ACCESS_TOKEN: (v) => TOKEN_OPACO.test(v),
  META_PAGE_ID: (v) => ID_NUMERICO.test(v),
  META_IG_USER_ID: (v) => ID_NUMERICO.test(v),
  LINKEDIN_ACCESS_TOKEN: (v) => TOKEN_OPACO.test(v),
  LINKEDIN_ORG_ID: (v) => ID_NUMERICO.test(v),
};

export const VARIABLES_CONOCIDAS = Object.freeze(Object.keys(VALIDAR));

/** 'falta', 'invalida' u 'ok'. Nunca el valor. */
export function estadoDeVariable(env, nombre) {
  const validar = VALIDAR[nombre];
  if (!validar) throw new Error(`Variable sin validación: ${nombre}`);
  const valor = leer(env, nombre);
  if (valor === null) return 'falta';
  return validar(valor) ? 'ok' : 'invalida';
}

/**
 * Lo necesario para entrar: URL y clave pública de Supabase y la lista de
 * administración. `listo` solo si las tres sirven.
 */
export function leerBase(env) {
  const nombres = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ADMIN_USER_IDS'];
  const faltan = nombres.filter((n) => estadoDeVariable(env, n) === 'falta');
  const invalidas = nombres.filter((n) => estadoDeVariable(env, n) === 'invalida');
  const listo = faltan.length === 0 && invalidas.length === 0;
  if (!listo) return { listo, faltan, invalidas };
  const ref = refDeSupabase(leer(env, 'SUPABASE_URL'));
  const admins = idsDeAdministracion(leer(env, 'ADMIN_USER_IDS'));
  return {
    listo,
    faltan,
    invalidas,
    ref,
    url: `https://${ref}.supabase.co`,
    clave: leer(env, 'SUPABASE_PUBLISHABLE_KEY'),
    admins: admins.validos,
    adminsInvalidos: admins.invalidos,
  };
}

/** El token de `Authorization: Bearer …`, o null. */
export function tokenDe(request) {
  const encabezado = request.headers.get('authorization');
  if (!encabezado) return null;
  const coincidencia = BEARER.exec(encabezado.trim());
  return coincidencia ? coincidencia[1] : null;
}

/**
 * Valida la sesión contra Supabase Auth (`/auth/v1/user`) y que el id esté en
 * ADMIN_USER_IDS. Devuelve `{ ok: true, usuarioId }` o el estado HTTP y el
 * código de error para responder. Nunca devuelve el mensaje de Supabase.
 */
export async function validarSesion(request, env, pedir = fetch) {
  const base = leerBase(env);
  if (!base.listo) return { ok: false, estado: 503, error: 'sinConfigurar' };
  const token = tokenDe(request);
  if (!token) return { ok: false, estado: 401, error: 'sinSesion' };

  let respuesta;
  try {
    respuesta = await pedir(`${base.url}/auth/v1/user`, {
      headers: { apikey: base.clave, Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch {
    return { ok: false, estado: 502, error: 'supabaseNoResponde' };
  }

  if (respuesta.status === 401 || respuesta.status === 403) {
    return { ok: false, estado: 401, error: 'sesionInvalida' };
  }
  if (!respuesta.ok) return { ok: false, estado: 502, error: 'supabaseNoResponde' };

  let usuario;
  try {
    usuario = await respuesta.json();
  } catch {
    return { ok: false, estado: 502, error: 'supabaseNoResponde' };
  }
  const id = typeof usuario?.id === 'string' ? usuario.id.toLowerCase() : '';
  if (!UUID.test(id)) return { ok: false, estado: 401, error: 'sesionInvalida' };
  if (!base.admins.has(id)) return { ok: false, estado: 403, error: 'sinPermiso' };
  return { ok: true, usuarioId: id, base };
}

/** Respuesta JSON que nunca se guarda en caché. */
export function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Vary: 'Authorization',
    },
  });
}

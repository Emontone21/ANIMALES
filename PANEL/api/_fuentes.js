/**
 * Las fuentes de datos de api/estado: el resumen de la base (admin_resumen(),
 * migración 0028) y la API de Vercel. Cada función devuelve `{ ok: true, … }`
 * o `{ ok: false, motivo }`, con un código propio: nunca el mensaje de otro
 * servicio, nunca un secreto.
 *
 * Lo que sale de acá ya está revisado: solo números, fechas en ISO y, de
 * Vercel, el estado del deploy, el hash corto del commit y el link al log.
 */

import { leer } from './_comun.js';

const TIEMPO_MAXIMO_MS = 5000;
const API_VERCEL = 'https://api.vercel.com';

/** Estados de un deploy que no son CANCELED (el Ignored Build Step cancela a propósito). */
const ESTADOS_DE_DEPLOY = ['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'BLOCKED'];
const SHA = /^[0-9a-f]{7,40}$/;

const entero = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);

function fecha(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const ms = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/**
 * El resumen tal como lo usa el panel, con cada valor revisado. Lo que no
 * tiene la forma esperada queda en null (y la tarjeta no lo muestra).
 */
export function limpiarResumen(crudo) {
  const r = objeto(crudo);
  const casos = objeto(r.casos);
  const coincidencias = objeto(r.coincidencias);
  const moderacion = objeto(r.moderacion);
  const usuarios = objeto(r.usuarios);
  const vision = objeto(r.vision);
  const almacenamiento = objeto(r.almacenamiento);
  const porDia = Array.isArray(casos.por_dia)
    ? casos.por_dia
        .map((d) => ({
          dia: typeof d?.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.dia) ? d.dia : null,
          casos: entero(d?.casos),
        }))
        .filter((d) => d.dia && d.casos !== null)
    : [];
  return {
    casos: {
      nuevos24h: entero(casos.nuevos_24h),
      nuevos7d: entero(casos.nuevos_7d),
      porDia: porDia.length === 7 ? porDia : null,
      abiertos: entero(casos.abiertos),
      reunidos: entero(casos.reunidos),
      reunidos30d: entero(casos.reunidos_30d),
    },
    coincidencias: {
      pendientes: entero(coincidencias.pendientes),
      pendienteDesde: fecha(coincidencias.pendiente_desde),
    },
    moderacion: {
      denuncias: entero(moderacion.denuncias_pendientes),
      casosOcultos: entero(moderacion.casos_ocultos),
      historiasOcultas: entero(moderacion.historias_ocultas),
      errores: entero(moderacion.errores_sin_resolver),
    },
    usuarios: {
      total: entero(usuarios.total),
      nuevos24h: entero(usuarios.nuevos_24h),
      nuevos7d: entero(usuarios.nuevos_7d),
    },
    vision: {
      esperando: entero(vision.esperando),
      esperandoDesde: fecha(vision.esperando_desde),
      trabadas: entero(vision.trabadas),
      sinReintentos: entero(vision.sin_reintentos),
      llamadas24h: entero(vision.llamadas_ia_24h),
      errores24h: entero(vision.errores_ia_24h),
      iaActiva: typeof vision.ia_activa === 'boolean' ? vision.ia_activa : null,
      // La única pausa que existe es 'sin_credito' (pausar_ia, 0018).
      iaSinCredito: vision.ia_pausa === 'sin_credito',
      ultimaProcesada: fecha(vision.ultima_procesada),
    },
    almacenamiento: {
      baseBytes: entero(almacenamiento.base_bytes),
      storageBytes: entero(almacenamiento.storage_bytes),
    },
  };
}

/**
 * admin_resumen() por PostgREST, con el token de quien entró (nunca la
 * service_role). La base decide: si la cuenta no está en administradores,
 * responde 42501.
 */
export async function leerResumen(base, token, pedir = fetch) {
  let respuesta;
  try {
    respuesta = await pedir(`${base.url}/rest/v1/rpc/admin_resumen`, {
      method: 'POST',
      headers: {
        apikey: base.clave,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      redirect: 'error',
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch {
    return { ok: false, motivo: 'supabaseNoResponde' };
  }

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }
  if (!respuesta.ok) {
    const codigo = typeof cuerpo?.code === 'string' ? cuerpo.code : '';
    if (codigo === 'PGRST202' || codigo === '42883' || respuesta.status === 404) {
      return { ok: false, motivo: 'sinMigracion' };
    }
    if (codigo === '42501' || respuesta.status === 403) {
      return { ok: false, motivo: 'noAdministrador' };
    }
    return { ok: false, motivo: 'supabaseNoResponde' };
  }
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return { ok: false, motivo: 'supabaseNoResponde' };
  }
  return { ok: true, resumen: limpiarResumen(cuerpo) };
}

async function pedirVercel(pedir, ruta, token) {
  let respuesta;
  try {
    respuesta = await pedir(`${API_VERCEL}${ruta}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch {
    return { ok: false, estado: 0 };
  }
  if (!respuesta.ok) return { ok: false, estado: respuesta.status };
  try {
    return { ok: true, cuerpo: await respuesta.json() };
  } catch {
    return { ok: false, estado: 0 };
  }
}

function motivoDeVercel(estado) {
  if (estado === 401 || estado === 403) return 'tokenInvalido';
  if (estado === 429) return 'limiteVercel';
  return 'vercelNoResponde';
}

/** El deploy de producción más reciente que no se canceló, revisado. */
export function limpiarDeploy(crudo) {
  const d = objeto(crudo);
  const estado = typeof d.readyState === 'string' ? d.readyState : d.state;
  if (!ESTADOS_DE_DEPLOY.includes(estado)) return null;
  const sha = objeto(d.meta).githubCommitSha;
  const inspector = typeof d.inspectorUrl === 'string' ? d.inspectorUrl : '';
  return {
    estado,
    commit: typeof sha === 'string' && SHA.test(sha) ? sha.slice(0, 7) : null,
    creado: fecha(d.createdAt ?? d.created),
    inspector: /^https:\/\/vercel\.com\/[\w./-]+$/.test(inspector) ? inspector : null,
  };
}

/**
 * Vercel: el vencimiento del token (`/v5/user/tokens/current`) y, si están el
 * equipo y el proyecto (`conProyecto`), el último deploy de producción de la
 * app (`/v7/deployments`). Si el token no sirve, los dos dan `tokenInvalido`.
 */
export async function leerVercel(env, { conProyecto }, pedir = fetch) {
  const token = leer(env, 'VERCEL_API_TOKEN');
  const consulta = conProyecto
    ? new URLSearchParams({
        projectId: leer(env, 'LINK_VERCEL_PROJECT'),
        slug: leer(env, 'LINK_VERCEL_TEAM'),
        target: 'production',
        state: ESTADOS_DE_DEPLOY.join(','),
        limit: '5',
      })
    : null;
  const [deTokens, deDeploys] = await Promise.all([
    pedirVercel(pedir, '/v5/user/tokens/current', token),
    consulta ? pedirVercel(pedir, `/v7/deployments?${consulta}`, token) : null,
  ]);

  let tokenVercel;
  if (deTokens.ok) {
    const vence = objeto(objeto(deTokens.cuerpo).token).expiresAt;
    tokenVercel = { ok: true, vence: vence === undefined || vence === null ? null : fecha(vence) };
  } else {
    tokenVercel = { ok: false, motivo: motivoDeVercel(deTokens.estado) };
  }

  let deploy;
  if (!deDeploys) deploy = null;
  else if (!tokenVercel.ok && tokenVercel.motivo === 'tokenInvalido') {
    deploy = { ok: false, motivo: 'tokenInvalido' };
  } else if (deDeploys.ok) {
    const lista = objeto(deDeploys.cuerpo).deployments;
    const ultimo = (Array.isArray(lista) ? lista : []).map(limpiarDeploy).find(Boolean);
    deploy = { ok: true, ultimo: ultimo ?? null };
  } else if (deDeploys.estado === 404) {
    deploy = { ok: false, motivo: 'proyectoNoEncontrado' };
  } else if (deDeploys.estado === 403 && tokenVercel.ok) {
    // El token sirve, pero no para ese equipo o proyecto.
    deploy = { ok: false, motivo: 'sinAccesoAlProyecto' };
  } else {
    deploy = { ok: false, motivo: motivoDeVercel(deDeploys.estado) };
  }
  return { token: tokenVercel, deploy };
}

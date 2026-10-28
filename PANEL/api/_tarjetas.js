/**
 * Los datos y el estado final de cada parte y tarjeta con `fuente`, a partir
 * de lo que leyó _fuentes.js. Los umbrales son los de DISEÑO.md, sección 3.4.
 *
 * Cada tarjeta lleva `datos` (solo números, fechas en ISO y, de Vercel, el
 * estado del deploy, el commit corto y el link al log) y `motivo`, un código
 * de `t.motivos` que dice por qué está en Atención o en Falla.
 *
 * Si la fuente falla, la tarjeta queda en Falla (o Pendiente, si falta la
 * migración) con el motivo de la fuente y sin datos: nunca un cero inventado.
 */

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** El plan gratuito de Supabase: 500 MB de base y 1 GB de Storage. */
export const LIMITES = { base: 500 * 1000 * 1000, storage: 1000 * 1000 * 1000 };

export const UMBRALES = {
  coincidenciaVieja: 3 * DIA,
  colaDetenida: 2 * HORA,
  deployTrabado: 15 * MINUTO,
  tokenPorVencer: 14 * DIA,
  usoAlto: 0.8,
  usoCasiLleno: 0.95,
};

const hace = (iso, ahora) => (iso ? ahora - Date.parse(iso) : 0);
const completo = (datos) => Object.values(datos).every((v) => v !== null && v !== undefined);

const ok = (datos) => ({ estado: 'ok', motivo: null, datos });
const atencion = (motivo, datos) => ({ estado: 'atencion', motivo, datos });
const falla = (motivo, datos = null) => ({ estado: 'falla', motivo, datos });

/**
 * Cada tarjeta del resumen: qué datos lleva y cuándo pasa a Atención o Falla.
 * Si falta un número, `datosIncompletos`. Las fechas sí pueden ser null (no
 * hay "desde cuándo" si no hay nada esperando).
 */
const DEL_RESUMEN = {
  'app.casosNuevos': (r) => {
    const datos = {
      nuevos24h: r.casos.nuevos24h,
      nuevos7d: r.casos.nuevos7d,
      porDia: r.casos.porDia,
    };
    if (!completo(datos)) return falla('datosIncompletos');
    return datos.nuevos7d === 0 ? atencion('sinCasos7d', datos) : ok(datos);
  },

  'app.reunidos': (r) => {
    const datos = { reunidos: r.casos.reunidos, reunidos30d: r.casos.reunidos30d };
    return completo(datos) ? ok(datos) : falla('datosIncompletos');
  },

  'app.coincidencias': (r, ahora) => {
    const { pendientes, pendienteDesde } = r.coincidencias;
    if (pendientes === null) return falla('datosIncompletos');
    const datos = { pendientes, pendienteDesde };
    return pendientes > 0 && hace(pendienteDesde, ahora) > UMBRALES.coincidenciaVieja
      ? atencion('coincidenciasViejas', datos)
      : ok(datos);
  },

  'app.moderacion': (r) => {
    const datos = { ...r.moderacion };
    if (!completo(datos)) return falla('datosIncompletos');
    if (datos.denuncias > 0) return atencion('denunciasPendientes', datos);
    if (datos.errores > 0) return atencion('erroresSinResolver', datos);
    return ok(datos);
  },

  'app.usuarios': (r) => {
    const datos = { ...r.usuarios };
    return completo(datos) ? ok(datos) : falla('datosIncompletos');
  },

  'app.fotosTrabadas': (r, ahora) => {
    const { trabadas, sinReintentos, esperando, esperandoDesde } = r.vision;
    if ([trabadas, sinReintentos, esperando].includes(null)) return falla('datosIncompletos');
    const datos = { trabadas, sinReintentos, esperandoDesde };
    if (sinReintentos > 0) return falla('fotosSinReintentos', datos);
    if (esperando > 0 && hace(esperandoDesde, ahora) > UMBRALES.colaDetenida) {
      return falla('colaDetenida', datos);
    }
    return trabadas > 0 ? atencion('fotosTrabadas', datos) : ok(datos);
  },

  'infra.supabase': (r) => {
    const { baseBytes, storageBytes } = r.almacenamiento;
    if (baseBytes === null || storageBytes === null) return falla('datosIncompletos');
    const datos = {
      baseBytes,
      storageBytes,
      baseLimite: LIMITES.base,
      storageLimite: LIMITES.storage,
    };
    const uso = Math.max(baseBytes / LIMITES.base, storageBytes / LIMITES.storage);
    if (uso >= UMBRALES.usoCasiLleno) return falla('usoCasiLleno', datos);
    return uso >= UMBRALES.usoAlto ? atencion('usoAlto', datos) : ok(datos);
  },

  // Las fotos trabadas o sin reintentos ya las avisa "Fotos trabadas".
  'infra.vision': (r) => {
    const v = r.vision;
    const datos = {
      esperando: v.esperando,
      llamadas24h: v.llamadas24h,
      errores24h: v.errores24h,
      iaActiva: v.iaActiva,
    };
    if (!completo(datos)) return falla('datosIncompletos');
    datos.ultimaProcesada = v.ultimaProcesada;
    if (v.iaSinCredito) return falla('iaSinCredito', datos);
    if (!datos.iaActiva) return atencion('iaApagada', datos);
    return datos.errores24h > 0 ? atencion('erroresIa', datos) : ok(datos);
  },
};

const EN_CURSO = ['BUILDING', 'INITIALIZING', 'QUEUED'];

function deDeploy(deploy, ahora) {
  if (!deploy.ok) return falla(deploy.motivo);
  if (!deploy.ultimo) return atencion('sinDeploys', null);
  const datos = { ...deploy.ultimo };
  if (datos.estado === 'ERROR' || datos.estado === 'BLOCKED') return falla('deployFallo', datos);
  if (EN_CURSO.includes(datos.estado) && hace(datos.creado, ahora) > UMBRALES.deployTrabado) {
    return atencion('deployTrabado', datos);
  }
  return ok(datos);
}

function deToken(token, ahora) {
  if (!token.ok) return falla(token.motivo);
  const datos = { vence: token.vence };
  if (!token.vence) return ok(datos);
  const falta = Date.parse(token.vence) - ahora;
  if (falta <= 0) return falla('tokenVencido', datos);
  return falta <= UMBRALES.tokenPorVencer ? atencion('tokenPorVencer', datos) : ok(datos);
}

/** Sin la migración, Pendiente; si no, Falla. */
function sinResumen(motivo) {
  return { estado: motivo === 'sinMigracion' ? 'pendiente' : 'falla', motivo, datos: null };
}

/**
 * El estado final de un ítem del catálogo. `config` es lo que dio
 * `estadoDe` (solo variables); si no está en `ok`, queda como está.
 * `fuentes`: `{ resumen, vercel, ahora }`.
 */
export function conDatos(item, config, fuentes) {
  if (config.estado !== 'ok' || !item.fuente) return config;
  const { resumen, vercel, ahora } = fuentes;

  let final;
  if (item.fuente === 'resumen') {
    if (!resumen.ok) final = sinResumen(resumen.motivo);
    else if (item.id === 'datosInternos') final = ok(null);
    else final = DEL_RESUMEN[item.id](resumen.resumen, ahora);
  } else if (!vercel) {
    // No se consultó: no debería pasar si las variables están.
    final = falla('vercelNoResponde');
  } else if (item.id === 'tokens.vercel') {
    final = deToken(vercel.token, ahora);
  } else if (item.id === 'infra.vercel') {
    final = vercel.deploy ? deDeploy(vercel.deploy, ahora) : falla('vercelNoResponde');
  } else {
    // La parte "Vercel": funciona si se pudo leer el token y los deploys.
    const problema = [vercel.token, vercel.deploy].find((x) => x && !x.ok);
    final = problema ? falla(problema.motivo) : ok(null);
  }
  return { ...config, ...final };
}

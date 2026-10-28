/**
 * Lo que llega del servidor y de Supabase Auth, revisado antes de usarlo.
 * Funciones puras (sin DOM): las prueba pruebas/datos.test.mjs.
 */

import { PARTES, TARJETAS } from './catalogo.js';

export const ESTADOS = ['ok', 'atencion', 'falla', 'pendiente', 'sinConfigurar'];

const VARIABLE = /^[A-Z][A-Z0-9_]{1,63}$/;
const URL_SUPABASE = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const PROMPTS = ['meta', 'linkedin', 'alertas'];

/** Motivos de una fuente (la base o Vercel): los avisa su parte de la configuración. */
const MOTIVOS_DE_FUENTE = [
  'sinMigracion',
  'noAdministrador',
  'supabaseNoResponde',
  'tokenInvalido',
  'limiteVercel',
  'vercelNoResponde',
  'proyectoNoEncontrado',
  'sinAccesoAlProyecto',
];

export const MOTIVOS = [
  'adminInvalidos',
  ...MOTIVOS_DE_FUENTE,
  'datosIncompletos',
  'tokenVencido',
  'tokenPorVencer',
  'sinDeploys',
  'deployFallo',
  'deployTrabado',
  'sinCasos7d',
  'coincidenciasViejas',
  'denunciasPendientes',
  'erroresSinResolver',
  'fotosTrabadas',
  'fotosSinReintentos',
  'colaDetenida',
  'usoAlto',
  'usoCasiLleno',
  'iaSinCredito',
  'iaApagada',
  'erroresIa',
];

const ESTADOS_DE_DEPLOY = ['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'BLOCKED'];

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
  motivo: 'sinEstado',
  datos: null,
});

// Cada campo de `datos` que conoce el panel y cómo se valida. Un valor que no
// cumple devuelve undefined: entonces no se muestra nada de esa tarjeta.
const entero = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : undefined);
const fecha = (v) => {
  if (v === null) return null;
  const ms = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
};

function linkDeVercel(v) {
  if (v === null) return null;
  try {
    const u = new URL(v);
    const ok = u.protocol === 'https:' && u.hostname === 'vercel.com' && !u.username && !u.port;
    return ok && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function porDia(v) {
  if (!Array.isArray(v) || v.length !== 7) return undefined;
  const dias = v.map((d) => ({
    dia: typeof d?.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.dia) ? d.dia : undefined,
    casos: entero(d?.casos),
  }));
  return dias.every((d) => d.dia !== undefined && d.casos !== undefined) ? dias : undefined;
}

const CAMPOS = {
  nuevos24h: entero,
  nuevos7d: entero,
  porDia,
  reunidos: entero,
  reunidos30d: entero,
  pendientes: entero,
  pendienteDesde: fecha,
  denuncias: entero,
  casosOcultos: entero,
  historiasOcultas: entero,
  errores: entero,
  total: entero,
  trabadas: entero,
  sinReintentos: entero,
  esperando: entero,
  esperandoDesde: fecha,
  llamadas24h: entero,
  errores24h: entero,
  iaActiva: (v) => (typeof v === 'boolean' ? v : undefined),
  ultimaProcesada: fecha,
  baseBytes: entero,
  storageBytes: entero,
  baseLimite: (v) => (entero(v) > 0 ? v : undefined),
  storageLimite: (v) => (entero(v) > 0 ? v : undefined),
  estado: (v) => (ESTADOS_DE_DEPLOY.includes(v) ? v : undefined),
  commit: (v) => (v === null || (typeof v === 'string' && /^[0-9a-f]{7}$/.test(v)) ? v : undefined),
  creado: fecha,
  inspector: linkDeVercel,
  vence: fecha,
};

/**
 * Los datos de una tarjeta: solo los campos conocidos, cada uno validado, con
 * las fechas en milisegundos. null si no hay datos; undefined si alguno no
 * tiene la forma esperada.
 */
export function normalizarDatos(crudo) {
  if (crudo === null || crudo === undefined) return null;
  if (typeof crudo !== 'object' || Array.isArray(crudo)) return undefined;
  const datos = {};
  for (const [clave, validar] of Object.entries(CAMPOS)) {
    if (!Object.hasOwn(crudo, clave)) continue;
    const valor = validar(crudo[clave]);
    if (valor === undefined) return undefined;
    datos[clave] = valor;
  }
  return datos;
}

function normalizarItem(crudo) {
  if (!crudo || typeof crudo !== 'object' || !ESTADOS.includes(crudo.estado)) return null;
  const datos = normalizarDatos(crudo.datos);
  if (datos === undefined) return null;
  return {
    estado: crudo.estado,
    faltan: variables(crudo.faltan),
    invalidas: variables(crudo.invalidas),
    prompt: PROMPTS.includes(crudo.prompt) ? crudo.prompt : null,
    motivo: MOTIVOS.includes(crudo.motivo) ? crudo.motivo : null,
    datos,
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
 * no sirve, o por el mismo motivo que una parte (Supabase no responde, el
 * token de Vercel no sirve), tampoco: ya la avisa esa parte.
 */
export function avisosDe(estado) {
  const motivosDePartes = new Set(
    [...estado.partes.values()]
      .filter((item) => item.estado === 'falla' || item.estado === 'atencion')
      .map((item) => item.motivo)
      .filter((motivo) => MOTIVOS_DE_FUENTE.includes(motivo)),
  );
  const todos = [
    ...[...estado.partes].map(([id, item]) => ({ tipo: 'parte', id, ...item })),
    ...[...estado.tarjetas]
      .filter(([, item]) => item.invalidas.length === 0 && !motivosDePartes.has(item.motivo))
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

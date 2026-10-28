/**
 * Arranque del Panel de SPOT: config pública → sesión → estado → Inicio.
 *
 * La página no decide quién entra: lo deciden api/config y api/estado, que
 * validan la sesión con Supabase Auth y la lista ADMIN_USER_IDS. Si responden
 * 401 se cierra la sesión y vuelve el ingreso; si responden 403, también se
 * cierra y se muestra "Acceso denegado".
 */

import { t } from '../i18n/es-UY.js';
import { leerConfig, leerEstado } from './api.js';
import { normalizarConfig, normalizarEstado } from './datos.js';
import { armarEnlaces } from './enlaces.js';
import { montarInicio } from './inicio.js';
import { pantallaCargando, pantallaDenegado, pantallaError, pantallaIngreso } from './pantallas.js';
import { crearSesion, ErrorDeIngreso } from './sesion.js';

const raiz = document.getElementById('raiz');

let sesion = null;
let inicio = null;

function mostrar(nodo, { enfocar = false } = {}) {
  if (inicio && inicio.nodo !== nodo) {
    inicio.desmontar();
    inicio = null;
  }
  raiz.replaceChildren(nodo);
  document.title = t.documento.titulo;
  if (enfocar) nodo.querySelector('h1')?.focus();
}

function mostrarIngreso(opciones = {}) {
  mostrar(pantallaIngreso({ alEntrar: ingresar, ...opciones }), {
    enfocar: Boolean(opciones.aviso),
  });
}

async function cerrarSesion() {
  if (sesion) await sesion.salir();
}

/**
 * Pide el estado y los links con el token y monta el Inicio. Devuelve
 * 'ok', o 'red' si no se pudo hablar con el servidor (las otras salidas ya
 * cambiaron de pantalla).
 */
async function entrar(token) {
  let estado;
  let config;
  try {
    [estado, config] = await Promise.all([leerEstado(token), leerConfig(token)]);
  } catch (error) {
    return manejarError(error);
  }
  inicio = montarInicio({
    estado: normalizarEstado(estado),
    enlaces: armarEnlaces(config?.enlaces),
    alActualizar: actualizar,
    alSalir: salir,
  });
  mostrar(inicio.nodo);
  inicio.enfocarTitulo();
  return 'ok';
}

async function manejarError(error) {
  if (error?.codigo === 'denegado') {
    await cerrarSesion();
    mostrar(pantallaDenegado({ alVolver: () => mostrarIngreso() }), { enfocar: true });
    return 'denegado';
  }
  if (error?.codigo === 'sesion') {
    await cerrarSesion();
    mostrarIngreso({ aviso: t.ingreso.sesionVencida });
    return 'sesion';
  }
  return 'red';
}

async function ingresar(email, contrasena) {
  let token;
  try {
    token = await sesion.ingresar(email, contrasena);
  } catch (error) {
    return error instanceof ErrorDeIngreso ? error.codigo : 'otro';
  }
  const resultado = await entrar(token);
  if (resultado === 'red') {
    await cerrarSesion();
    return 'red';
  }
  return null;
}

async function actualizar() {
  if (!inicio) return;
  const actual = inicio;
  actual.ocupado(true);
  try {
    const token = await sesion.token();
    if (!token) {
      mostrarIngreso({ aviso: t.ingreso.sesionVencida });
      return;
    }
    const estado = await leerEstado(token);
    if (inicio === actual) actual.actualizar(normalizarEstado(estado), { anunciar: true });
  } catch (error) {
    if ((await manejarError(error)) === 'red' && inicio === actual) actual.marcarError();
  } finally {
    if (inicio === actual) actual.ocupado(false);
  }
}

async function salir() {
  await cerrarSesion();
  mostrarIngreso();
}

async function arrancar() {
  mostrar(pantallaCargando());

  let config;
  try {
    config = normalizarConfig(await leerConfig());
  } catch {
    mostrar(pantallaError({ alReintentar: arrancar }), { enfocar: true });
    return;
  }

  if (!config.supabase) {
    mostrarIngreso({ configuracion: { faltan: config.faltan, invalidas: config.invalidas } });
    return;
  }

  sesion = crearSesion(config.supabase);
  if (!sesion) {
    mostrarIngreso({ bloqueada: true });
    return;
  }

  const token = await sesion.token();
  if (!token) {
    mostrarIngreso();
    return;
  }
  if ((await entrar(token)) === 'red') {
    mostrar(pantallaError({ alReintentar: arrancar }), { enfocar: true });
  }
}

arrancar();

/**
 * Lo que las pruebas hacen directo contra el proyecto de Supabase de pruebas,
 * fuera del navegador: crear y borrar las cuentas (la API de administración de
 * Auth, con la clave secreta), marcar a la familia como moderadora, y vaciar
 * sus carpetas de los buckets "fotos" y "capturas" con la API de Storage.
 * Nunca por SQL. Solo lo usan global-setup.ts y global-teardown.ts.
 */
import { readFileSync } from 'node:fs';

import type { Cuenta } from './cuentas';
import { encabezados, type Entorno, esClaveNueva, RUTAS } from './entorno';

const ESPERA_MS = 30_000;

type Opciones = {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Por defecto la secreta. */
  clave?: string;
  /** La sesión de una persona (Authorization: Bearer). */
  jwt?: string;
  cuerpo?: unknown;
  headers?: Record<string, string>;
};

type Respuesta = { estado: number; datos: unknown };

/** Un error de Supabase con el estado y lo que respondió (nunca las claves). */
export class ErrorSupabase extends Error {
  constructor(
    readonly accion: string,
    readonly estado: number,
    readonly datos: unknown,
  ) {
    super(`${accion}: Supabase respondió ${estado} ${JSON.stringify(datos).slice(0, 300)}`);
  }

  /** El código de error de Auth (error_code) o de PostgREST (code). */
  get codigo(): string | null {
    const datos = this.datos as { error_code?: string; code?: string } | null;
    return datos?.error_code ?? datos?.code ?? null;
  }
}

/**
 * La secreta nueva (sb_secret_…) va solo en apikey, como toda clave nueva en
 * este repo (src/lib/env.ts): el gateway de Supabase la cambia por un JWT de
 * service_role. Si un servicio la rechazara así (401 o 403), se prueba una vez
 * como la manda supabase-js, también en Authorization, y se sigue de esa forma.
 */
let secretaTambienEnAuthorization = false;

function encabezadosDe(entorno: Entorno, clave: string, jwt?: string): Record<string, string> {
  const secretaNueva = !jwt && clave === entorno.claveSecreta && esClaveNueva(clave);
  return secretaNueva && secretaTambienEnAuthorization
    ? { apikey: clave, Authorization: `Bearer ${clave}` }
    : encabezados(clave, jwt);
}

/**
 * fetch con una segunda oportunidad si se cae la conexión (TypeError "fetch
 * failed"): pasa cuando reusa una conexión que el servidor ya cerró.
 */
async function buscar(url: string, init: Omit<RequestInit, 'signal'>): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
  }
}

async function pedir(entorno: Entorno, ruta: string, opciones: Opciones = {}): Promise<Respuesta> {
  const { metodo = 'GET', clave = entorno.claveSecreta, jwt, cuerpo, headers = {} } = opciones;
  const respuesta = await buscar(`${entorno.supabaseUrl}${ruta}`, {
    method: metodo,
    headers: {
      ...encabezadosDe(entorno, clave, jwt),
      ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let datos: unknown = texto;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    // Queda el texto tal cual.
  }
  const rechazada = respuesta.status === 401 || respuesta.status === 403;
  const secretaNueva = !jwt && clave === entorno.claveSecreta && esClaveNueva(clave);
  if (rechazada && secretaNueva && !secretaTambienEnAuthorization) {
    secretaTambienEnAuthorization = true;
    console.warn(
      `[e2e] ${ruta} rechazó la clave secreta solo en apikey (${respuesta.status}): se prueba también en Authorization.`,
    );
    return pedir(entorno, ruta, opciones);
  }
  return { estado: respuesta.status, datos };
}

function exigir(accion: string, respuesta: Respuesta, aceptados: number[] = [200]): unknown {
  if (!aceptados.includes(respuesta.estado)) {
    throw new ErrorSupabase(accion, respuesta.estado, respuesta.datos);
  }
  return respuesta.datos;
}

/**
 * VERSION_TERMINOS de src/features/legal/terminos.ts, leída del archivo: ese
 * módulo importa React Query y el cliente de la app, que no corren en Node.
 */
export function leerVersionTerminos(): string {
  const fuente = readFileSync(RUTAS.terminos, 'utf8');
  const version = /export const VERSION_TERMINOS = '([^']+)'/.exec(fuente)?.[1];
  if (!version) {
    throw new Error(`No encontré VERSION_TERMINOS en ${RUTAS.terminos}: ¿cambió cómo se declara?`);
  }
  return version;
}

// --- Cuentas (API de administración de Auth) ----------------------------------

/**
 * Crea una cuenta ya confirmada (sin mail) con los términos vigentes aceptados:
 * handle_new_user (migración 0011) guarda en perfiles el nombre y la versión
 * que vienen en user_metadata, si es la vigente. Devuelve el id.
 */
export async function crearCuenta(
  entorno: Entorno,
  datos: { email: string; contrasena: string; nombre: string; terminosVersion: string },
): Promise<string> {
  const respuesta = await pedir(entorno, '/auth/v1/admin/users', {
    metodo: 'POST',
    cuerpo: {
      email: datos.email,
      password: datos.contrasena,
      email_confirm: true,
      user_metadata: { nombre_publico: datos.nombre, terminos_version: datos.terminosVersion },
    },
  });
  const usuario = exigir('Crear la cuenta de prueba', respuesta) as { id?: unknown };
  if (typeof usuario.id !== 'string') {
    throw new ErrorSupabase(
      'Crear la cuenta de prueba (sin id)',
      respuesta.estado,
      respuesta.datos,
    );
  }
  return usuario.id;
}

export async function existeCuenta(entorno: Entorno, id: string): Promise<boolean> {
  const respuesta = await pedir(entorno, `/auth/v1/admin/users/${id}`);
  if (respuesta.estado === 404) return false;
  exigir('Buscar la cuenta de prueba', respuesta);
  return true;
}

/** Si se borra desde acá, el trigger de perfiles deja publicado lo abierto (limpiar_cuenta). */
async function borrarCuentaAdmin(entorno: Entorno, id: string): Promise<void> {
  const respuesta = await pedir(entorno, `/auth/v1/admin/users/${id}`, { metodo: 'DELETE' });
  exigir('Borrar la cuenta de prueba', respuesta, [200, 204, 404]);
}

/** Ingresa como la persona, igual que la app (sin captcha: spot-pruebas no lo tiene). */
export async function ingresarConContrasena(
  entorno: Entorno,
  email: string,
  contrasena: string,
): Promise<string> {
  const respuesta = await pedir(entorno, '/auth/v1/token?grant_type=password', {
    metodo: 'POST',
    clave: entorno.clavePublica,
    cuerpo: { email, password: contrasena },
  });
  const sesion = exigir('Ingresar con la cuenta de prueba', respuesta) as { access_token?: string };
  if (!sesion.access_token) {
    throw new ErrorSupabase('Ingresar (sin sesión)', respuesta.estado, respuesta.datos);
  }
  return sesion.access_token;
}

// --- Perfiles (PostgREST) -------------------------------------------------------

export type PerfilDePrueba = {
  id: string;
  nombre_publico: string;
  es_moderador: boolean;
  terminos_version: string | null;
};

export async function leerPerfil(entorno: Entorno, id: string): Promise<PerfilDePrueba | null> {
  const respuesta = await pedir(
    entorno,
    `/rest/v1/perfiles?id=eq.${id}&select=id,nombre_publico,es_moderador,terminos_version`,
  );
  const filas = exigir('Leer el perfil de prueba', respuesta) as PerfilDePrueba[];
  return filas[0] ?? null;
}

/**
 * es_moderador se asigna solo por SQL o con la clave secreta: la app no puede
 * (0007 deja a authenticated cambiar solo nombre_publico y avatar_path) y el
 * trigger perfiles_validar mira solo esas dos columnas.
 */
export async function marcarModeradora(entorno: Entorno, id: string): Promise<void> {
  const respuesta = await pedir(entorno, `/rest/v1/perfiles?id=eq.${id}`, {
    metodo: 'PATCH',
    cuerpo: { es_moderador: true },
    headers: { Prefer: 'return=representation' },
  });
  const filas = exigir('Marcar a la familia como moderadora', respuesta) as PerfilDePrueba[];
  if (filas.length !== 1 || !filas[0].es_moderador) {
    throw new ErrorSupabase('Marcar a la familia como moderadora', respuesta.estado, filas);
  }
}

// --- Storage ------------------------------------------------------------------------

/** Borra todo lo de la carpeta <id>/ de un bucket con la API de Storage. Devuelve cuántos. */
export async function vaciarCarpeta(
  entorno: Entorno,
  bucket: 'fotos' | 'capturas',
  id: string,
): Promise<number> {
  const tanda = 100;
  let borrados = 0;
  // Se lista desde el principio cada vez: lo borrado ya no aparece.
  for (;;) {
    const lista = await pedir(entorno, `/storage/v1/object/list/${bucket}`, {
      metodo: 'POST',
      cuerpo: {
        prefix: `${id}/`,
        limit: tanda,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      },
    });
    const objetos = exigir(`Listar ${bucket}/${id}/`, lista) as {
      name: string;
      id: string | null;
    }[];
    // Sin id son carpetas: las fotos van sueltas en <id>/ (src/lib/fotos.ts).
    const rutas = objetos.filter((o) => o.id !== null).map((o) => `${id}/${o.name}`);
    if (rutas.length === 0) return borrados;
    const borrado = await pedir(entorno, `/storage/v1/object/${bucket}`, {
      metodo: 'DELETE',
      cuerpo: { prefixes: rutas },
    });
    const hechos = exigir(`Borrar de ${bucket}/${id}/`, borrado) as unknown[];
    if (hechos.length === 0) {
      throw new Error(`Storage no borró nada de ${bucket}/${id}/ (${rutas.length} archivos).`);
    }
    borrados += hechos.length;
  }
}

// --- Limpieza ---------------------------------------------------------------------

/**
 * Deja el proyecto de pruebas como estaba antes de la cuenta. Tolera que la
 * cuenta ya no exista (la última prueba la borra desde la app).
 *
 * 1. Si la cuenta existe, ingresa como ella y llama a borrar_mi_cuenta con
 *    "Borrarlo" (p_conservar_abiertos false), lo mismo que la app: se borra
 *    todo lo suyo, también sus encontrados abiertos. Borrarla solo con la API de
 *    administración los dejaría publicados sin autor (el trigger de perfiles
 *    usa la opción por defecto) y, sin sus fotos, rotos en el mapa compartido.
 * 2. Vacía sus carpetas de "fotos" y "capturas" con la API de Storage. Siempre,
 *    aunque la cuenta ya no exista: lo que dejó publicado en un caso ajeno
 *    conserva sus fotos, y si después se borra ese caso, quedan huérfanas.
 * 3. Si la cuenta sigue existiendo (falló el paso 1), la borra con la API de
 *    administración.
 *
 * Devuelve si quedó todo limpio.
 */
export async function limpiarCuenta(entorno: Entorno, cuenta: Cuenta): Promise<boolean> {
  const quien = `${cuenta.proyecto}/${cuenta.rol} (${cuenta.email})`;
  let ok = true;
  try {
    if (await existeCuenta(entorno, cuenta.id)) {
      try {
        const jwt = await ingresarConContrasena(entorno, cuenta.email, cuenta.contrasena);
        const respuesta = await pedir(entorno, '/rest/v1/rpc/borrar_mi_cuenta', {
          metodo: 'POST',
          clave: entorno.clavePublica,
          jwt,
          cuerpo: { p_conservar_abiertos: false },
        });
        exigir('borrar_mi_cuenta', respuesta, [200, 204]);
      } catch (error) {
        console.warn(`[e2e] ${quien}: no se pudo borrar como la app (${String(error)}).`);
      }
    }
    for (const bucket of ['fotos', 'capturas'] as const) {
      const borrados = await vaciarCarpeta(entorno, bucket, cuenta.id);
      if (borrados > 0) console.log(`[e2e] ${quien}: ${borrados} archivos borrados de ${bucket}.`);
    }
    if (await existeCuenta(entorno, cuenta.id)) {
      console.warn(`[e2e] ${quien}: se borra con la API de administración.`);
      await borrarCuentaAdmin(entorno, cuenta.id);
      ok = !(await existeCuenta(entorno, cuenta.id));
    }
  } catch (error) {
    console.error(`[e2e] ${quien}: no se pudo limpiar: ${String(error)}`);
    ok = false;
  }
  return ok;
}

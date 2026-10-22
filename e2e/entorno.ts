/**
 * Variables de entorno, rutas y constantes de las pruebas de punta a punta.
 * Corren siempre contra el proyecto de Supabase de pruebas (spot-pruebas),
 * nunca contra producción: crean cuentas, publican casos y los borran.
 * Ninguna clave vive en el repo: todo sale de acá, del entorno.
 */
import path from 'node:path';

/** El proyecto de producción. Es público (está en public/index.html). */
export const REF_PRODUCCION = 'bwqvuttuodwypwxckxgf';

/** Donde e2e/servidor.mjs sirve el build. Supabase de pruebas lo tiene en sus Redirect URLs. */
export const PUERTO = 4173;

/** El sitio del build (EXPO_PUBLIC_SITE_URL): los links que se comparten son <SITIO>/animal/<id>. */
export const SITIO = `http://localhost:${PUERTO}`;

export const RUTAS = {
  raiz: path.resolve(__dirname, '..'),
  /** El build web de las pruebas (`npx expo export -p web --output-dir e2e/.dist`). */
  dist: path.resolve(__dirname, '.dist'),
  /** Las cuentas que crea global-setup.ts y borra global-teardown.ts. */
  cuentas: path.resolve(__dirname, '.auth', 'cuentas.json'),
  /** La foto que se elige en cada formulario: un JPEG de 800 × 600. */
  foto: path.resolve(__dirname, 'datos', 'perro.jpg'),
  /** De acá se lee VERSION_TERMINOS: importarlo traería React y Supabase. */
  terminos: path.resolve(__dirname, '..', 'src', 'features', 'legal', 'terminos.ts'),
} as const;

export type Entorno = {
  /** Sin barra al final: https://<ref>.supabase.co */
  supabaseUrl: string;
  /** La clave que va en el build: la publishable o, de respaldo, la anon. */
  clavePublica: string;
  tipoClavePublica: 'publishable' | 'anon';
  /** Solo para crear y borrar las cuentas de prueba y vaciar sus carpetas de Storage. */
  claveSecreta: string;
};

const AYUDA =
  'Las pruebas de punta a punta corren contra el proyecto de Supabase de pruebas (spot-pruebas), nunca contra producción. Ver e2e/LEEME.md.';

function limpio(valor: string | undefined): string {
  return valor?.trim() ?? '';
}

/**
 * Igual que esClaveNueva de src/lib/env.ts (no se importa: ese archivo exige
 * las variables EXPO_PUBLIC_ al cargarse). Las claves nuevas (sb_publishable_…,
 * sb_secret_…) no son JWT; la anon y la service_role legacy sí.
 */
export function esClaveNueva(clave: string): boolean {
  return clave.startsWith('sb_');
}

/** Los datos de una clave legacy (un JWT): de qué proyecto es y qué rol tiene. */
function datosDelJwt(clave: string): { ref?: string; role?: string } | null {
  const partes = clave.split('.');
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) as {
      ref?: string;
      role?: string;
    };
  } catch {
    return null;
  }
}

/** El ref del proyecto, si la URL es la de siempre (https://<ref>.supabase.co). */
function refDeLaUrl(url: URL): string | null {
  return url.hostname.endsWith('.supabase.co') ? url.hostname.split('.')[0] : null;
}

/**
 * Lee y valida el entorno. Corta con un error claro si falta algo o si algo
 * apunta a producción.
 */
export function leerEntorno(variables: NodeJS.ProcessEnv = process.env): Entorno {
  const url = limpio(variables.E2E_SUPABASE_URL).replace(/\/+$/, '');
  const publishable = limpio(variables.E2E_SUPABASE_PUBLISHABLE_KEY);
  const anon = limpio(variables.E2E_SUPABASE_ANON_KEY);
  const claveSecreta = limpio(variables.E2E_SUPABASE_SECRET_KEY);

  const faltan = [
    url ? null : 'E2E_SUPABASE_URL',
    publishable || anon ? null : 'E2E_SUPABASE_PUBLISHABLE_KEY (o E2E_SUPABASE_ANON_KEY)',
    claveSecreta ? null : 'E2E_SUPABASE_SECRET_KEY',
  ].filter((nombre): nombre is string => nombre !== null);
  if (faltan.length > 0) {
    throw new Error(`Faltan variables de entorno: ${faltan.join(', ')}. ${AYUDA}`);
  }

  // Salvaguarda: nunca contra producción, ni por la URL ni por las claves.
  if (url.toLowerCase().includes(REF_PRODUCCION)) {
    throw new Error(
      `E2E_SUPABASE_URL apunta a producción (${REF_PRODUCCION}). Estas pruebas crean y borran cuentas y casos: usá el proyecto de pruebas. ${AYUDA}`,
    );
  }
  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    throw new Error(`E2E_SUPABASE_URL no es una URL: "${url}". ${AYUDA}`);
  }
  const local = direccion.hostname === 'localhost' || direccion.hostname === '127.0.0.1';
  if (direccion.protocol !== 'https:' && !local) {
    throw new Error(`E2E_SUPABASE_URL tiene que ser https://<ref>.supabase.co. ${AYUDA}`);
  }

  const clavePublica = publishable || anon;
  const tipoClavePublica = publishable ? 'publishable' : 'anon';
  const refUrl = refDeLaUrl(direccion);
  const revisar = (nombre: string, clave: string, rolEsperado: 'anon' | 'service_role') => {
    if (esClaveNueva(clave)) return;
    const datos = datosDelJwt(clave);
    if (!datos) throw new Error(`${nombre} no parece una clave de Supabase. ${AYUDA}`);
    if (datos.ref === REF_PRODUCCION) {
      throw new Error(`${nombre} es una clave de producción (${REF_PRODUCCION}). ${AYUDA}`);
    }
    if (refUrl && datos.ref && datos.ref !== refUrl) {
      throw new Error(
        `${nombre} es de otro proyecto (${datos.ref}) que E2E_SUPABASE_URL. ${AYUDA}`,
      );
    }
    if (datos.role && datos.role !== rolEsperado) {
      throw new Error(`${nombre} tiene el rol "${datos.role}" y se esperaba "${rolEsperado}".`);
    }
  };

  const nombrePublica = publishable ? 'E2E_SUPABASE_PUBLISHABLE_KEY' : 'E2E_SUPABASE_ANON_KEY';
  // La pública va dentro del build: si fuera la secreta, quedaría en los archivos de e2e/.dist.
  if (clavePublica.startsWith('sb_secret_')) {
    throw new Error(
      `${nombrePublica} es una clave secreta (sb_secret_…): esa va en E2E_SUPABASE_SECRET_KEY y nunca en el build.`,
    );
  }
  if (claveSecreta.startsWith('sb_publishable_')) {
    throw new Error(
      'E2E_SUPABASE_SECRET_KEY es la publishable: hace falta la secreta (sb_secret_…).',
    );
  }
  revisar(nombrePublica, clavePublica, 'anon');
  revisar('E2E_SUPABASE_SECRET_KEY', claveSecreta, 'service_role');

  return { supabaseUrl: url, clavePublica, tipoClavePublica, claveSecreta };
}

/**
 * Headers con una clave de Supabase, como src/lib/env.ts: una clave nueva va
 * solo en apikey (no es un JWT; con la secreta, el gateway de Supabase la
 * cambia por un JWT de service_role para Auth, PostgREST y Storage); una
 * legacy va en apikey y como Bearer. Con `jwt`, la sesión de una persona.
 */
export function encabezados(clave: string, jwt?: string): Record<string, string> {
  if (jwt) return { apikey: clave, Authorization: `Bearer ${jwt}` };
  return esClaveNueva(clave)
    ? { apikey: clave }
    : { apikey: clave, Authorization: `Bearer ${clave}` };
}

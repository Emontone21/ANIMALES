/**
 * Qué muestra el Inicio y en qué orden (DISEÑO.md, "Pantallas y tarjetas").
 * Los ids de partes y tarjetas son los de api/_catalogo.js (lo comprueba
 * pruebas/catalogo.test.mjs).
 */

export const VISTAS = ['inicio', 'app', 'infraestructura', 'redes', 'tokens'];

/** Las partes del bloque "Configuración del panel", en orden. */
export const PARTES = [
  'ingreso',
  'enlaces',
  'datosInternos',
  'vercel',
  'meta',
  'linkedin',
  'alertas',
];

/**
 * Las secciones de tarjetas. `numeros`: grilla de números (dos columnas en el
 * celular); `servicios`: tarjetas en la computadora y filas tocables en el
 * celular; `tokens`: una lista.
 */
export const SECCIONES = [
  {
    id: 'app',
    tipo: 'numeros',
    tarjetas: [
      'app.casosNuevos',
      'app.reunidos',
      'app.coincidencias',
      'app.moderacion',
      'app.usuarios',
      'app.fotosTrabadas',
    ],
  },
  {
    id: 'infraestructura',
    tipo: 'servicios',
    tarjetas: ['infra.vercel', 'infra.supabase', 'infra.vision'],
  },
  {
    id: 'redes',
    tipo: 'servicios',
    tarjetas: ['redes.facebook', 'redes.instagram', 'redes.linkedin'],
  },
  {
    id: 'tokens',
    tipo: 'tokens',
    tarjetas: ['tokens.vercel', 'tokens.meta', 'tokens.linkedin'],
  },
];

export const TARJETAS = SECCIONES.flatMap((seccion) => seccion.tarjetas);

/**
 * El link "Abrir en…" de cada tarjeta: el texto (clave de `t.enlaces`) y la
 * URL, que sale de lo que arma js/enlaces.js. Si la URL no está (falta su
 * variable), la tarjeta no muestra el link.
 */
export const ENLACE_DE_TARJETA = {
  'app.casosNuevos': { texto: 'supabase', url: (e) => e.supabase?.editor },
  'app.reunidos': { texto: 'app', url: (e) => e.app?.reencuentros },
  'app.coincidencias': { texto: 'supabase', url: (e) => e.supabase?.editor },
  'app.moderacion': { texto: 'supabase', url: (e) => e.supabase?.editor },
  'app.usuarios': { texto: 'supabase', url: (e) => e.supabase?.usuarios },
  'app.fotosTrabadas': { texto: 'supabase', url: (e) => e.supabase?.funciones },
  'infra.vercel': { texto: 'vercel', url: (e) => e.vercel?.deploys },
  'infra.supabase': { texto: 'supabase', url: (e) => e.supabase?.baseDeDatos },
  'infra.vision': { texto: 'supabase', url: (e) => e.supabase?.funciones },
  'redes.facebook': { texto: 'facebook', url: (e) => e.facebook },
  'redes.instagram': { texto: 'instagram', url: (e) => e.instagram },
  'redes.linkedin': { texto: 'linkedin', url: (e) => e.linkedin },
  'tokens.vercel': { texto: 'vercel', url: (e) => e.fijos.tokensVercel },
  'tokens.meta': { texto: 'metaDesarrolladores', url: (e) => e.fijos.depuradorMeta },
  'tokens.linkedin': { texto: 'linkedinDesarrolladores', url: (e) => e.fijos.appsLinkedin },
};

/** La variable de cada token, para la lista de Tokens. */
export const VARIABLE_DE_TOKEN = {
  'tokens.vercel': 'VERCEL_API_TOKEN',
  'tokens.meta': 'META_ACCESS_TOKEN',
  'tokens.linkedin': 'LINKEDIN_ACCESS_TOKEN',
};

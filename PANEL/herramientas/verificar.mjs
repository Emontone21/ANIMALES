// Verificaciones del Panel de SPOT, sin dependencias. Desde PANEL/:
//   node herramientas/verificar.mjs   (o npm run verificar)
//
// 1. node --check de cada archivo JavaScript.
// 2. Los colores de estilos.css (claro y oscuro) son los de DISEÑO.md, 4.1, y
//    no hay colores en otro lado (salvo favicon.svg, que se compara).
// 3. Ningún archivo tiene secretos, tokens ni valores reales de configuración.
// 4. Los textos de index.html dicen lo mismo que i18n/es-UY.js.
// 5. Cada fuente coincide con su hash de fuentes/ORIGEN.md.
// 6. Reglas del código: sin innerHTML ni eval, sin importar de fuera de PANEL/,
//    sin leer variables por patrón y la CSP con el mismo supabase-js que la página.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PANEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fallas = [];
let correctas = 0;

function comprobar(nombre, ok, detalle = '') {
  if (ok) correctas += 1;
  else fallas.push(`${nombre}${detalle ? `: ${detalle}` : ''}`);
}

function archivos(carpeta = PANEL) {
  const salida = [];
  for (const nombre of readdirSync(carpeta)) {
    if (nombre === 'node_modules' || nombre === '.vercel' || nombre === '.git') continue;
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else salida.push(ruta);
  }
  return salida;
}

const rel = (ruta) => relative(PANEL, ruta).split(sep).join('/');
const leer = (ruta) => readFileSync(join(PANEL, ruta), 'utf8');
const todos = archivos();
const deTexto = todos.filter((r) => !/\.(woff2|png|jpg|ico)$/.test(r));
const javascript = todos.filter((r) => ['.js', '.mjs'].includes(extname(r)));

// 1. Sintaxis ----------------------------------------------------------------
for (const ruta of javascript) {
  const r = spawnSync(process.execPath, ['--check', ruta], { encoding: 'utf8' });
  comprobar(`node --check ${rel(ruta)}`, r.status === 0, r.stderr.trim());
}

// 2. Colores -----------------------------------------------------------------
const diseno = leer('DISEÑO.md');
const seccionColores = diseno.split('### 4.1 Colores')[1]?.split('### 4.2')[0] ?? '';
const hex = (texto) => [...texto.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());

// Qué variable corresponde a cada fila de las tablas de DISEÑO.md, 4.1.
const FILAS = {
  'Fondo de la página': ['fondo'],
  'Superficie (tarjetas, cabecera)': ['superficie'],
  'Borde de tarjeta': ['borde-tarjeta'],
  'Borde de botón secundario': ['borde-boton'],
  'Separador entre filas': ['separador'],
  'Borde punteado (pendiente o sin configurar)': ['borde-punteado'],
  Texto: ['texto'],
  'Texto secundario': ['texto-secundario'],
  Acento: ['acento'],
  'Acento al pasar el mouse': ['acento-hover'],
  'Texto sobre el acento': ['texto-sobre-acento'],
  'Ítem activo del menú (fondo)': ['menu-activo'],
  'Barras suaves y pista de barras de uso': ['barra-suave', 'barra-pista'],
  'Funciona / Al día': ['ok-texto', 'ok-fondo'],
  Atención: ['atencion-texto', 'atencion-fondo'],
  Falla: ['falla-texto', 'falla-fondo'],
  Pendiente: ['pendiente-texto', 'pendiente-fondo'],
  'Sin configurar': ['sin-configurar-texto', 'sin-configurar-fondo'],
};

const esperado = { claro: {}, oscuro: {} };
for (const linea of seccionColores.split('\n')) {
  const celdas = linea.split('|').map((c) => c.trim());
  const variables = FILAS[celdas[1]];
  if (!variables) continue;
  const claro = hex(celdas[2]);
  const oscuro = hex(celdas[3]);
  variables.forEach((v, i) => {
    esperado.claro[v] = claro[i];
    esperado.oscuro[v] = oscuro[i];
  });
}
comprobar(
  'DISEÑO.md 4.1: todas las filas de colores',
  Object.keys(esperado.claro).length === 24,
  `${Object.keys(esperado.claro).length} de 24`,
);

const css = leer('estilos.css');
const bloqueClaro = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
const bloqueOscuro =
  css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? '';
const variablesDe = (bloque) =>
  Object.fromEntries(
    [...bloque.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [
      m[1],
      m[2].toUpperCase(),
    ]),
  );
const claro = variablesDe(bloqueClaro);
const oscuro = variablesDe(bloqueOscuro);
for (const [modo, valores, definidos] of [
  ['claro', esperado.claro, claro],
  ['oscuro', esperado.oscuro, oscuro],
]) {
  for (const [variable, color] of Object.entries(valores)) {
    comprobar(
      `estilos.css ${modo} --${variable}`,
      definidos[variable] === color,
      `${definidos[variable]} y DISEÑO.md dice ${color}`,
    );
  }
  const sobran = Object.keys(definidos).filter((v) => !(v in valores));
  comprobar(
    `estilos.css ${modo}: sin colores fuera de DISEÑO.md`,
    sobran.length === 0,
    sobran.join(', '),
  );
}
const cssSinRoot = css.replace(bloqueClaro, '').replace(bloqueOscuro, '');
comprobar(
  'estilos.css: colores solo en :root',
  hex(cssSinRoot).length === 0 && !/\b(rgb|rgba|hsl|hsla)\(/.test(cssSinRoot),
  hex(cssSinRoot).join(' '),
);
for (const ruta of deTexto) {
  const r = rel(ruta);
  if (!/^(js|i18n|api)\/|^index\.html$/.test(r)) continue;
  comprobar(`${r}: sin colores escritos`, hex(readFileSync(ruta, 'utf8')).length === 0);
}
const favicon = new Set(hex(leer('favicon.svg')));
comprobar(
  'favicon.svg: acento y texto sobre el acento del modo claro',
  favicon.size === 2 &&
    favicon.has(esperado.claro.acento) &&
    favicon.has(esperado.claro['texto-sobre-acento']),
  [...favicon].join(' '),
);

// 3. Secretos y valores reales ------------------------------------------------
const PELIGROSOS = [
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['clave de Supabase', /sb_(secret|publishable)_[A-Za-z0-9]{20,}/],
  [
    'URL de un proyecto de Supabase',
    /https:\/\/(?!abcdefghijklmnopqrst\.)[a-z0-9]{20}\.supabase\.co/,
  ],
  ['ids de Vercel', /\b(prj|team|dpl)_[A-Za-z0-9]{16,}/],
  ['dominio .vercel.app', /\b[a-z0-9-]+\.vercel\.app\b/],
  ['token de Meta', /\bEAA[A-Za-z0-9]{30,}/],
  ['token de LinkedIn', /\bAQ[A-Za-z0-9_-]{60,}/],
  ['token de Hugging Face', /\bhf_[A-Za-z0-9]{30,}/],
  ['token de GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['clave de Anthropic', /sk-ant-[A-Za-z0-9-]{10,}/],
  ['client id de Google', /\d{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com/],
  ['clave privada', /BEGIN [A-Z ]*PRIVATE KEY/],
  [
    'uuid real',
    /\b(?!00000000-0000-4000-8000-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  ],
  ['email real', /[A-Za-z0-9._%+-]+@(?!example\.(org|com)\b)[A-Za-z0-9-]+\.[A-Za-z.]{2,}/],
];
for (const ruta of deTexto) {
  const texto = readFileSync(ruta, 'utf8');
  for (const [que, patron] of PELIGROSOS) {
    const encontrado = texto.match(patron);
    comprobar(`${rel(ruta)}: sin ${que}`, !encontrado, encontrado?.[0]);
  }
}
const envs = todos.map(rel).filter((r) => /(^|\/)\.env(\.|$)/.test(r) && r !== '.env.example');
comprobar('sin archivos .env (salvo .env.example)', envs.length === 0, envs.join(', '));
const conValor = leer('.env.example')
  .split('\n')
  .filter((l) => /^[A-Z][A-Z0-9_]*=.+/.test(l));
comprobar('.env.example sin valores', conValor.length === 0, conValor.join(' | '));

// 4. Textos de index.html ------------------------------------------------------
const { t } = await import(pathToFileURL(join(PANEL, 'i18n/es-UY.js')).href);
const html = leer('index.html');
const titulo = html.match(/<title>([^<]*)<\/title>/)?.[1];
comprobar('index.html: <title> igual a t.documento.titulo', titulo === t.documento.titulo, titulo);
const sinJs = html.match(/<noscript>\s*<p[^>]*>([^<]*)<\/p>\s*<\/noscript>/)?.[1];
comprobar(
  'index.html: aviso sin JavaScript igual a t.general.sinJavascript',
  sinJs === t.general.sinJavascript,
  sinJs,
);

// 5. Fuentes ------------------------------------------------------------------
const origen = leer('fuentes/ORIGEN.md');
const hashes = Object.fromEntries(
  [...origen.matchAll(/\|\s*`([^`]+)`[^|]*\|[^|]*\|[^|]*\|\s*`([0-9a-f]{64})`\s*\|/g)].map((m) => [
    m[1],
    m[2],
  ]),
);
const enCss = [...css.matchAll(/url\('fuentes\/([^']+)'\)/g)].map((m) => m[1]);
comprobar('estilos.css: seis @font-face', enCss.length === 6, String(enCss.length));
for (const archivo of [...enCss, 'LICENSE.txt']) {
  let hash = null;
  try {
    hash = createHash('sha256')
      .update(readFileSync(join(PANEL, 'fuentes', archivo)))
      .digest('hex');
  } catch {
    // Falta el archivo: lo dice la comprobación.
  }
  comprobar(
    `fuentes/${archivo}: existe y coincide con ORIGEN.md`,
    hash !== null && hash === hashes[archivo],
    hash ?? 'no existe',
  );
}

// 6. Reglas del código --------------------------------------------------------
const PROHIBIDO =
  /\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write|\beval\(|new Function\(/;
const POR_PATRON =
  /Object\.(keys|entries|values)\(\s*(process\.)?env\b|\.\.\.\s*(process\.)?env\b|\bin\s+(process\.)?env\b/;
for (const ruta of javascript) {
  const r = rel(ruta);
  if (r.startsWith('herramientas/') || r.startsWith('pruebas/')) continue;
  const codigo = readFileSync(ruta, 'utf8');
  comprobar(`${r}: sin innerHTML ni eval`, !PROHIBIDO.test(codigo));
  comprobar(`${r}: sin leer variables por patrón`, !POR_PATRON.test(codigo));
}
for (const ruta of javascript) {
  const codigo = readFileSync(ruta, 'utf8');
  for (const m of codigo.matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)) {
    const destino = m[1];
    if (destino.startsWith('node:')) {
      comprobar(
        `${rel(ruta)}: importa ${destino}`,
        !/^(js|i18n)\//.test(rel(ruta)),
        'node: en el navegador',
      );
      continue;
    }
    const absoluta = resolve(dirname(ruta), destino);
    comprobar(
      `${rel(ruta)}: importa ${destino} desde PANEL/`,
      destino.startsWith('.') && absoluta.startsWith(PANEL + sep),
    );
  }
}
const cdn = html.match(/<script[^>]*src="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"[^>]*>/);
const integridad = cdn?.[0].match(/integrity="(sha384-[A-Za-z0-9+/=]{64})"/)?.[1];
comprobar(
  'index.html: supabase-js con versión exacta y SRI sha384',
  Boolean(cdn && /@\d+\.\d+\.\d+\//.test(cdn[1]) && integridad),
  cdn?.[1],
);
const vercel = JSON.parse(leer('vercel.json'));
const csp =
  vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')
    ?.value ?? '';
comprobar(
  'vercel.json: la CSP permite el mismo supabase-js que la página',
  Boolean(cdn) && csp.includes(`script-src 'self' ${cdn[1]};`),
  csp,
);
const scriptsAjenos = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((s) => s.startsWith('http') && s !== cdn?.[1]);
comprobar(
  'index.html: ningún otro script de afuera',
  scriptsAjenos.length === 0,
  scriptsAjenos.join(' '),
);
comprobar('index.html: sin scripts en línea', !/<script(?![^>]*\bsrc=)[^>]*>/.test(html));

// -----------------------------------------------------------------------------
console.log(`${correctas} comprobaciones bien, ${fallas.length} con problemas.`);
for (const falla of fallas) console.log(`  FALLA ${falla}`);
process.exit(fallas.length > 0 ? 1 : 0);

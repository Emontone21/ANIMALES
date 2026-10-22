/**
 * El build web de las pruebas: el mismo `npx expo export -p web` que va a
 * Vercel, pero apuntado al proyecto de Supabase de pruebas y servido en
 * localhost (e2e/servidor.mjs). Sin captcha: spot-pruebas no lo tiene.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type Entorno, REF_PRODUCCION, RUTAS, SITIO } from './entorno';

/** Anota con qué se armó el build, para no reusar uno de otro proyecto con E2E_SIN_BUILD=1. */
const MARCA = path.join(RUTAS.dist, '.e2e-build.json');

type Marca = { supabaseUrl: string; sitio: string; armadoEn: string };

/** Los archivos de texto del build, donde podría quedar una URL o una clave. */
const TEXTO = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.webmanifest', '.txt']);

function marcaCoincide(entorno: Entorno): boolean {
  if (!existsSync(path.join(RUTAS.dist, 'index.html')) || !existsSync(MARCA)) return false;
  const marca = JSON.parse(readFileSync(MARCA, 'utf8')) as Marca;
  return marca.supabaseUrl === entorno.supabaseUrl && marca.sitio === SITIO;
}

/** 0x04 y 64 bytes al azar, en base64url: la forma de una clave pública de P-256. */
function clavePushDePrueba(): string {
  const punto = randomBytes(65);
  punto[0] = 4;
  return punto.toString('base64url');
}

async function exportar(entorno: Entorno): Promise<void> {
  const publishable = entorno.tipoClavePublica === 'publishable';
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Sin los .env del repo: el de cada uno suele apuntar a producción.
    EXPO_NO_DOTENV: '1',
    CI: '1',
    EXPO_PUBLIC_SUPABASE_URL: entorno.supabaseUrl,
    // Vacías y no ausentes: así ningún valor de afuera se cuela en el build (src/lib/env.ts).
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable ? entorno.clavePublica : '',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: publishable ? '' : entorno.clavePublica,
    EXPO_PUBLIC_SITE_URL: SITIO,
    EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
    // Una clave con la forma de una VAPID pública, nueva en cada build: las pruebas
    // simulan el push del navegador (ayudas.ts) y no mandan nada.
    EXPO_PUBLIC_VAPID_PUBLIC_KEY: clavePushDePrueba(),
  };
  // La secreta no tiene nada que hacer en el proceso del build.
  delete env.E2E_SUPABASE_SECRET_KEY;

  console.log(`[e2e] armando el build web para ${entorno.supabaseUrl} en e2e/.dist…`);
  const argumentos = [
    'expo',
    'export',
    '-p',
    'web',
    '--output-dir',
    path.relative(RUTAS.raiz, RUTAS.dist),
    '--clear',
  ];
  // Sin bloquear el proceso (no spawnSync): mientras dura el build, las conexiones
  // que quedaron abiertas con Supabase se cierran a tiempo y no se reusan muertas.
  await new Promise<void>((resolver, rechazar) => {
    const build = spawn('npx', argumentos, {
      cwd: RUTAS.raiz,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    build.on('error', rechazar);
    build.on('exit', (codigo) =>
      codigo === 0
        ? resolver()
        : rechazar(new Error(`npx expo export -p web terminó con ${String(codigo)}.`)),
    );
  });
  const marca: Marca = {
    supabaseUrl: entorno.supabaseUrl,
    sitio: SITIO,
    armadoEn: new Date().toISOString(),
  };
  writeFileSync(MARCA, `${JSON.stringify(marca, null, 2)}\n`);
}

/**
 * public/index.html abre de antemano la conexión a la Supabase de producción
 * (preconnect, que no pide nada pero sí conecta): en el build de las pruebas
 * se cambia por la de pruebas.
 */
function cambiarPreconnect(entorno: Entorno): void {
  const indice = path.join(RUTAS.dist, 'index.html');
  const html = readFileSync(indice, 'utf8');
  const origen = new URL(entorno.supabaseUrl).origin;
  writeFileSync(indice, html.replaceAll(`https://${REF_PRODUCCION}.supabase.co`, origen));
}

function* archivos(carpeta: string): Generator<string> {
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) yield* archivos(ruta);
    else yield ruta;
  }
}

/** Salvaguarda: en el build no puede quedar nada de producción ni la clave secreta. */
function revisarBuild(entorno: Entorno): void {
  const problemas: string[] = [];
  for (const archivo of archivos(RUTAS.dist)) {
    if (!TEXTO.has(path.extname(archivo))) continue;
    const contenido = readFileSync(archivo, 'utf8');
    const relativo = path.relative(RUTAS.raiz, archivo);
    if (contenido.includes(REF_PRODUCCION)) problemas.push(`${relativo} nombra a producción`);
    if (contenido.includes(entorno.claveSecreta)) {
      problemas.push(`${relativo} tiene la clave secreta`);
    }
  }
  if (problemas.length > 0) {
    throw new Error(`El build de las pruebas no es seguro: ${problemas.join('; ')}.`);
  }
}

/**
 * Arma (o reusa, con E2E_SIN_BUILD=1, si es del mismo proyecto) el build y lo
 * deja listo para servir.
 */
export async function prepararBuild(entorno: Entorno): Promise<void> {
  const saltear = process.env.E2E_SIN_BUILD === '1';
  if (saltear && marcaCoincide(entorno)) {
    console.log('[e2e] E2E_SIN_BUILD=1: se usa el build que ya está en e2e/.dist.');
  } else {
    if (saltear) {
      console.log(
        '[e2e] E2E_SIN_BUILD=1, pero e2e/.dist falta o es de otro proyecto: se arma igual.',
      );
    }
    await exportar(entorno);
  }
  cambiarPreconnect(entorno);
  revisarBuild(entorno);
}

/**
 * public/index.html y public/manifest.webmanifest: lo único con colores y
 * textos fuera de tema.ts y es-UY.ts (la pantalla de carga, la descripción,
 * theme-color y el manifest de la app instalable). Estas pruebas los mantienen
 * iguales. También, que el service worker no guarde nada.
 */
import { FAMILIAS, paletas } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

// Sin tipos de Node en el proyecto: lo justo de fs. Jest corre desde la raíz del repo.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs') as {
  readFileSync: ((ruta: string, codificacion: 'utf8') => string) &
    ((ruta: string) => { readUInt32BE: (posicion: number) => number });
  existsSync: (ruta: string) => boolean;
};
const { copias } = require('../scripts/copiar-a-public.js') as { copias: [string, string][] };
/* eslint-enable @typescript-eslint/no-require-imports */
const raiz = process.cwd();
const html = fs.readFileSync(`${raiz}/public/index.html`, 'utf8');

describe('public/index.html', () => {
  test('cada color de la pantalla de carga es el token que dice su comentario', () => {
    const colores = [
      ...html.matchAll(/--carga-[a-z]+: (#[0-9A-Fa-f]{6}); \/\* (claro|oscuro)\.(\w+) \*\//g),
    ];
    expect(colores.length).toBeGreaterThanOrEqual(12);
    for (const [, valor, esquema, token] of colores) {
      const paleta = paletas[esquema as 'claro' | 'oscuro'] as Record<string, string>;
      expect({ token: `${esquema}.${token}`, valor }).toEqual({
        token: `${esquema}.${token}`,
        valor: paleta[token],
      });
    }
  });

  test('los textos son los de es-UY.ts', () => {
    expect(html).toContain(`<p class="carga-nombre">${t.app.nombre}</p>`);
    expect(html).toContain(`<span class="carga-texto">${t.comunes.cargando}</span>`);
    expect(html).toContain(
      `<meta name="description" content="${t.compartir.vistaPrevia.descripcionGenerica}" />`,
    );
  });

  test('declara las fuentes de tema.ts con su peso, desde los archivos que copia postinstall', () => {
    const pesos: Record<string, string> = {
      [FAMILIAS.titulo]: '600',
      [FAMILIAS.regular]: '400',
      [FAMILIAS.seminegrita]: '600',
      [FAMILIAS.negrita]: '700',
    };
    const caras = [
      ...html.matchAll(
        /font-family: '(\w+)';\s+src: url\('\/([^']+)'\) format\('truetype'\);\s+font-weight: (\d+);\s+font-display: swap;/g,
      ),
    ].map(([, familia, archivo, peso]) => ({ familia, archivo, peso }));
    expect(caras.map((c) => c.familia).sort()).toEqual(Object.values(FAMILIAS).sort());
    // Arrancan apagadas: las activa la app después de las fotos (src/lib/fuentesWeb.ts).
    expect(html).toContain('<style id="encontrados-fuentes" media="not all">');
    const copiados = copias.map(([, destino]) => destino);
    for (const cara of caras) {
      expect(cara.peso).toBe(pesos[cara.familia]);
      expect(copiados).toContain(cara.archivo);
    }
  });

  test('lo que copia postinstall existe en node_modules', () => {
    for (const [origen] of copias) {
      expect(fs.existsSync(`${raiz}/node_modules/${origen}`)).toBe(true);
    }
  });

  test('theme-color es el fondo de cada paleta', () => {
    const colores = [
      ...html.matchAll(
        /<meta name="theme-color" content="(#[0-9A-Fa-f]{6})" media="\(prefers-color-scheme: (light|dark)\)" \/><!-- (claro|oscuro)\.(\w+) -->/g,
      ),
    ];
    expect(colores.map(([, , esquema]) => esquema)).toEqual(['light', 'dark']);
    for (const [, valor, , paleta, token] of colores) {
      expect(token).toBe('fondo');
      expect(valor).toBe(paletas[paleta as 'claro' | 'oscuro'].fondo);
    }
  });

  test('enlaza el manifest y el ícono de iPhone, y guarda el aviso de instalar antes de la app', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/iconos/apple-touch-icon.png" />');
    expect(fs.existsSync(`${raiz}/public/iconos/apple-touch-icon.png`)).toBe(true);
    // El script va en el <head>, antes del JS de la app.
    expect(html.indexOf("addEventListener('beforeinstallprompt'")).toBeLessThan(
      html.indexOf('<div id="root">'),
    );
    expect(html).toContain("navigator.serviceWorker.register('/sw.js')");
  });
});

/** Ancho y alto de un PNG, de su encabezado. */
function tamanioPng(ruta: string): string {
  const bytes = fs.readFileSync(ruta);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('public/manifest.webmanifest', () => {
  const manifest = JSON.parse(fs.readFileSync(`${raiz}/public/manifest.webmanifest`, 'utf8')) as {
    name: string;
    short_name: string;
    description: string;
    lang: string;
    start_url: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };

  test('nombre y descripción de es-UY.ts, start_url "/" y standalone', () => {
    expect(manifest.name).toBe(t.app.nombre);
    expect(manifest.short_name).toBe(t.app.nombre);
    expect(manifest.description).toBe(t.compartir.vistaPrevia.descripcionGenerica);
    expect(manifest.lang).toBe('es-UY');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  test('los colores son el fondo de la paleta clara', () => {
    expect(manifest.background_color).toBe(paletas.claro.fondo);
    expect(manifest.theme_color).toBe(paletas.claro.fondo);
  });

  test('íconos de 192 y 512 y uno maskable, que existen y miden lo que dicen', () => {
    const usos = manifest.icons.map((i) => `${i.sizes} ${i.purpose}`).sort();
    expect(usos).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const icono of manifest.icons) {
      const ruta = `${raiz}/public${icono.src}`;
      expect(fs.existsSync(ruta)).toBe(true);
      expect(icono.type).toBe('image/png');
      expect(tamanioPng(ruta)).toBe(icono.sizes);
    }
    expect(tamanioPng(`${raiz}/public/iconos/apple-touch-icon.png`)).toBe('180x180');
  });
});

describe('public/sw.js', () => {
  const sw = fs.readFileSync(`${raiz}/public/sw.js`, 'utf8');

  test('tiene un manejador de fetch con algo adentro (Chrome lo pide para ofrecer instalar)', () => {
    expect(sw).toMatch(/addEventListener\('fetch', \(evento\) => \{\n\s+\S/);
  });

  test('no guarda nada: ni Cache Storage, ni IndexedDB, ni respuestas propias', () => {
    expect(sw).not.toMatch(/caches\.|indexedDB|cache\.put|new Response/);
    expect(sw).not.toContain('supabase');
  });
});

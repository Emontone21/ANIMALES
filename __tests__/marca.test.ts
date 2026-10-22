/**
 * Lo que repite el nombre de la app o los colores fuera de es-UY.ts y tema.ts:
 * app.json, el logo y los íconos (assets/marca/ y assets/images/) y las
 * plantillas de mail (supabase/templates/), con sus links a /auth/confirmar.
 * También, que es-UY.ts no use el
 * nombre viejo y que la versión de los términos de la app sea la que pone la
 * última migración.
 */
import { paletas } from '@/constants/tema';
import { VERSION_TERMINOS } from '@/features/legal/terminos';
import { t } from '@/i18n/es-UY';
import { leerParametros, linkDeMail } from '@/lib/urlAuth';

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs') as {
  readFileSync: ((ruta: string, codificacion: 'utf8') => string) &
    ((ruta: string) => { readUInt32BE: (posicion: number) => number });
  readdirSync: (ruta: string) => string[];
  existsSync: (ruta: string) => boolean;
};
const { plantillas } = require('../scripts/plantillas-mail.js') as {
  plantillas: () => { tipo: string; asunto: string; archivo: string }[];
};
/* eslint-enable @typescript-eslint/no-require-imports */
const raiz = process.cwd();
const leer = (ruta: string) => fs.readFileSync(`${raiz}/${ruta}`, 'utf8');

describe('app.json', () => {
  const app = JSON.parse(leer('app.json')).expo;

  test('el nombre es el de es-UY.ts y los permisos lo nombran', () => {
    expect(app.name).toBe(t.app.nombre);
    const permisos = JSON.stringify(app.plugins);
    expect(permisos).toContain(`${t.app.nombre} usa tu ubicación`);
    expect(permisos).not.toMatch(/Encontrados/);
  });

  test('los colores del ícono, la carga y los avisos son el primario claro', () => {
    expect(app.android.adaptiveIcon.backgroundColor).toBe(paletas.claro.primario);
    const plugin = (nombre: string) =>
      app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === nombre)[1];
    expect(plugin('expo-splash-screen').backgroundColor).toBe(paletas.claro.primario);
    expect(plugin('expo-notifications').color).toBe(paletas.claro.primario);
  });

  test('el ícono es el del logo en todas las plataformas, no el de la plantilla de Expo', () => {
    expect(app.icon).toBe('./assets/images/icon.png');
    expect(app.ios.icon ?? app.icon).toBe('./assets/images/icon.png');
    expect(fs.existsSync(`${raiz}/assets/expo.icon`)).toBe(false);
  });
});

describe('logo (assets/marca/) e íconos (assets/images/)', () => {
  const svg = (archivo: string) => leer(`assets/marca/${archivo}`);
  const colores = (archivo: string) =>
    [
      ...new Set([...svg(archivo).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(([c]) => c.toUpperCase())),
    ].sort();
  const valores = (esquema: 'claro' | 'oscuro', ...tokens: (keyof typeof paletas.claro)[]) =>
    tokens.map((token) => paletas[esquema][token].toUpperCase()).sort();
  /** Lo que dibuja sin los colores: si cambia, cambió la forma o la proporción. */
  const forma = (archivo: string) => svg(archivo).replace(/#[0-9A-Fa-f]{6}\b/g, '#');

  test('cada archivo usa los colores de tema.ts de su esquema (DISENO.md, 5.2)', () => {
    expect(colores('spot-logo.svg')).toEqual(valores('claro', 'primario', 'texto'));
    expect(colores('spot-marca.svg')).toEqual(valores('claro', 'primario', 'texto'));
    expect(colores('spot-logo-oscuro.svg')).toEqual(valores('oscuro', 'primario', 'texto'));
    expect(colores('spot-marca-oscuro.svg')).toEqual(valores('oscuro', 'primario', 'texto'));
    expect(colores('spot-marca-negro.svg')).toEqual(valores('claro', 'texto'));
    expect(colores('spot-marca-blanco.svg')).toEqual(valores('claro', 'textoSobrePrimario'));
    expect(colores('spot-icono.svg')).toEqual(valores('claro', 'primario', 'fondo', 'texto'));
  });

  test('las versiones de cada pieza tienen la misma forma', () => {
    expect(forma('spot-logo-oscuro.svg')).toBe(forma('spot-logo.svg'));
    for (const variante of [
      'spot-marca-oscuro.svg',
      'spot-marca-negro.svg',
      'spot-marca-blanco.svg',
    ]) {
      expect(forma(variante)).toBe(forma('spot-marca.svg'));
    }
  });

  test('los íconos de assets/images/ miden lo que piden app.json y cada sistema', () => {
    const tamanio = (archivo: string) => {
      const bytes = fs.readFileSync(`${raiz}/assets/images/${archivo}`);
      return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
    };
    expect(tamanio('icon.png')).toBe('1024x1024');
    expect(tamanio('android-icon-foreground.png')).toBe('512x512');
    expect(tamanio('android-icon-background.png')).toBe('512x512');
    expect(tamanio('android-icon-monochrome.png')).toBe('432x432');
    expect(tamanio('favicon.png')).toBe('48x48');
    expect(tamanio('splash-icon.png')).toBe('228x244');
  });
});

test('es-UY.ts no usa "Encontrados" como nombre de la app; como categoría, sí', () => {
  // Cada texto entre comillas que lo dice con mayúscula, también dentro de las funciones.
  const fuente = leer('src/i18n/es-UY.ts');
  const textos = [
    ...fuente.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.)*?Encontrados(?:(?!\1)[^\\\n]|\\.)*)\1/g),
  ].map(([, , texto]) => texto);
  expect(textos.length).toBe((fuente.match(/Encontrados/g) ?? []).length);
  // La categoría es la etiqueta sola (el chip del mapa), nunca dentro de una oración
  // como "avisá en Encontrados" o "Encontrados usa tu ubicación".
  expect(textos).toContain('Encontrados');
  for (const texto of textos) expect(texto).toBe('Encontrados');
  expect(t.app.nombre).not.toMatch(/encontrados/i);
});

describe('plantillas de mail (supabase/templates/)', () => {
  const lista = plantillas();
  const coloresClaros = Object.values(paletas.claro).map((c) => c.toUpperCase());

  test('confirmar la cuenta, recuperar la contraseña, cambiar el email y enlace mágico', () => {
    expect(lista.map((p) => p.tipo).sort()).toEqual([
      'confirmation',
      'email_change',
      'magic_link',
      'recovery',
    ]);
    const archivos = fs
      .readdirSync(`${raiz}/supabase/templates`)
      .filter((a) => a.endsWith('.html'));
    expect(archivos.sort()).toEqual(lista.map((p) => p.archivo.split('/').pop()).sort());
  });

  /** El type de cada link: el que verifyOtp espera para esa plantilla. */
  const TIPO_DEL_LINK: Record<string, string | null> = {
    confirmation: 'signup',
    recovery: 'recovery',
    email_change: 'email_change',
    // La app no usa el enlace mágico: su mail no trae link.
    magic_link: null,
  };

  test.each(plantillas())('$archivo: el link va a /auth/confirmar', ({ tipo, archivo }) => {
    const html = leer(archivo);
    // ConfirmationURL pasa por Supabase y vuelve con un ?code= que solo sirve en
    // el navegador que pidió el mail (PKCE).
    expect(html).not.toContain('ConfirmationURL');
    const links = [...html.matchAll(/href="([^"]*)"/g)].map(([, link]) => link);
    const tipoDelLink = TIPO_DEL_LINK[tipo];
    if (tipoDelLink === null) {
      expect(links).toEqual([]);
      expect(html).not.toContain('TokenHash');
      return;
    }
    const esperado = `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&amp;type=${tipoDelLink}`;
    // El botón y el link para copiar, también como texto.
    expect(links).toEqual([esperado, esperado]);
    expect(html.split(esperado)).toHaveLength(4);
    // La app lo entiende (src/app/auth/confirmar.tsx).
    const url = esperado
      .replace('{{ .SiteURL }}', 'https://spot.test')
      .replace('{{ .TokenHash }}', 'pkce_0123456789abcdef')
      .replaceAll('&amp;', '&');
    expect(linkDeMail(leerParametros(url))).toEqual({
      tokenHash: 'pkce_0123456789abcdef',
      tipo: tipoDelLink,
    });
  });

  test.each(plantillas())('$archivo: asunto, nombre y colores', ({ asunto, archivo }) => {
    const html = leer(archivo);
    expect(html).toContain(`<title>${asunto}</title>`);
    expect(asunto).toContain(t.app.nombre);
    expect(html).not.toMatch(/Encontrados/);
    // Nada externo: ni imágenes ni fuentes ni links fijos.
    expect(html).not.toMatch(/<img|<link|https?:\/\//i);
    // Ni datos que escribe la persona (el nombre público podría traer un link).
    expect(html).not.toContain('.Data');
    const colores = [...html.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(([c]) => c.toUpperCase());
    expect(colores.length).toBeGreaterThan(5);
    for (const color of colores) expect(coloresClaros).toContain(color);
  });
});

test('VERSION_TERMINOS es la terminos_version de la última migración que la cambia', () => {
  const migraciones = fs
    .readdirSync(`${raiz}/supabase/migrations`)
    .filter((a) => a.endsWith('.sql'))
    .sort();
  const versiones = migraciones.flatMap((archivo) => {
    const sql = leer(`supabase/migrations/${archivo}`);
    const cambio = sql.match(
      /update public\.config_app set valor = '([^']+)', updated_at = now\(\)\s+where clave = 'terminos_version'/,
    );
    return cambio ? [cambio[1]] : [];
  });
  expect(versiones.at(-1)).toBe(VERSION_TERMINOS);
});

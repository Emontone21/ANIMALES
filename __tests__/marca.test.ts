/**
 * Lo que repite el nombre de la app o los colores fuera de es-UY.ts y tema.ts:
 * app.json, el script del ícono (scripts/iconos-web.py) y las plantillas de mail
 * (supabase/templates/). También, que la versión de los términos de la app sea
 * la que pone la última migración.
 */
import { paletas } from '@/constants/tema';
import { VERSION_TERMINOS } from '@/features/legal/terminos';
import { t } from '@/i18n/es-UY';

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs') as {
  readFileSync: (ruta: string, codificacion: 'utf8') => string;
  readdirSync: (ruta: string) => string[];
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
});

test('el script del ícono usa los colores de tema.ts que dice su comentario', () => {
  const script = leer('scripts/iconos-web.py');
  const colores = [...script.matchAll(/^\w+ = "(#[0-9A-Fa-f]{6})"  # (claro|oscuro)\.(\w+)$/gm)];
  expect(colores).toHaveLength(2);
  for (const [, valor, esquema, token] of colores) {
    const paleta = paletas[esquema as 'claro' | 'oscuro'] as Record<string, string>;
    expect({ token, valor }).toEqual({ token, valor: paleta[token] });
  }
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

  test.each(plantillas())('$archivo: asunto, link, nombre y colores', ({ asunto, archivo }) => {
    const html = leer(archivo);
    expect(html).toContain(`<title>${asunto}</title>`);
    expect(asunto).toContain(t.app.nombre);
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
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

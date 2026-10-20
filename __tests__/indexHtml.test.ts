/**
 * public/index.html: lo único con colores y textos fuera de tema.ts y es-UY.ts
 * (la pantalla de carga y la descripción). Estas pruebas los mantienen iguales.
 */
import { FAMILIAS, paletas } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

// Sin tipos de Node en el proyecto: lo justo de fs. Jest corre desde la raíz del repo.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs') as {
  readFileSync: (ruta: string, codificacion: 'utf8') => string;
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
});

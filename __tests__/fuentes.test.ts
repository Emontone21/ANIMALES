/**
 * La tipografía (docs/DISENO.md, sección 3): Urbanist, una sola familia en tres
 * pesos. Que cada familia de tema.ts se cargue en nativo (useFuentes) y en web
 * (las @font-face de public/index.html, con los archivos que copia postinstall
 * a public/fuentes/), y que no quede nada de las fuentes de antes.
 */
import { FAMILIAS } from '@/constants/tema';
import { ARCHIVOS_DE_FUENTES } from '@/hooks/useFuentes';

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

const familias = [...new Set(Object.values(FAMILIAS))];
/** Las @font-face de index.html: familia, archivo y peso. */
const caras = [
  ...html.matchAll(
    /font-family: '(\w+)';\s+src: url\('\/([^']+)'\) format\('truetype'\);\s+font-weight: (\d+);/g,
  ),
].map(([, familia, archivo, peso]) => ({ familia, archivo, peso }));

describe('las fuentes de la app', () => {
  test('son Urbanist: el texto en Medium, la seminegrita en SemiBold y los títulos y la negrita en Bold', () => {
    expect(FAMILIAS).toEqual({
      titulo: 'Urbanist_700Bold',
      regular: 'Urbanist_500Medium',
      seminegrita: 'Urbanist_600SemiBold',
      negrita: 'Urbanist_700Bold',
    });
  });

  test('toda familia de FAMILIAS se carga en nativo (useFuentes)', () => {
    expect(Object.keys(ARCHIVOS_DE_FUENTES).sort()).toEqual([...familias].sort());
    for (const archivo of Object.values(ARCHIVOS_DE_FUENTES)) expect(archivo).toBeDefined();
  });

  test('toda familia está declarada una vez en public/index.html, con el peso de su nombre', () => {
    expect(caras.map((c) => c.familia).sort()).toEqual([...familias].sort());
    for (const cara of caras) {
      expect(cara.archivo).toBe(`fuentes/${cara.familia}.ttf`);
      // Urbanist_500Medium se declara con font-weight: 500.
      expect(cara.peso).toBe(cara.familia.match(/_(\d00)/)?.[1]);
    }
  });

  test('todo archivo que se declara lo copia postinstall y existe en public/fuentes/', () => {
    const copiados = copias.map(([, destino]) => destino);
    for (const cara of caras) {
      expect(copiados).toContain(cara.archivo);
      expect(fs.existsSync(`${raiz}/public/${cara.archivo}`)).toBe(true);
    }
    // Y no copia fuentes que nadie declara.
    expect(copiados.filter((d) => d.startsWith('fuentes/')).sort()).toEqual(
      caras.map((c) => c.archivo).sort(),
    );
  });

  test('no queda nada de Fredoka ni de Figtree', () => {
    const declaradas = [
      ...familias,
      ...Object.keys(ARCHIVOS_DE_FUENTES),
      ...caras.map((c) => c.archivo),
      ...copias.map(([origen]) => origen),
    ];
    for (const nombre of declaradas) expect(nombre).not.toMatch(/fredoka|figtree/i);
    expect(html).not.toMatch(/fredoka|figtree/i);
    const paquete = fs.readFileSync(`${raiz}/package.json`, 'utf8');
    expect(paquete).not.toMatch(/fredoka|figtree/i);
  });
});

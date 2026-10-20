// Copia a public/ lo que la web sirve tal cual desde node_modules. Corre en postinstall.
// - El worker y los estilos de MapLibre GL JS: Metro no sirve archivos de node_modules
//   como workers (la app le indica la URL con setWorkerUrl) y los estilos los pide el
//   bloque del mapa al cargarse, para que no estén en el <head> de la carga inicial
//   (src/components/mapa/maplibreWeb.ts).
// - Las fuentes de la app: en web las declara public/index.html con @font-face y
//   font-display: swap, así nada espera a que bajen (src/hooks/useFuentes.web.ts).
const fs = require('node:fs');
const path = require('node:path');

const modulos = path.join(__dirname, '..', 'node_modules');
const publico = path.join(__dirname, '..', 'public');

/** [origen en node_modules, destino en public/] */
const copias = [
  ['maplibre-gl/dist/maplibre-gl-worker.mjs', 'maplibre-gl-worker.mjs'],
  ['maplibre-gl/dist/maplibre-gl.css', 'maplibre-gl.css'],
  [
    '@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf',
    'fuentes/Fredoka_600SemiBold.ttf',
  ],
  [
    '@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf',
    'fuentes/Figtree_400Regular.ttf',
  ],
  [
    '@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf',
    'fuentes/Figtree_600SemiBold.ttf',
  ],
  ['@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf', 'fuentes/Figtree_700Bold.ttf'],
];

function copiar() {
  const faltan = copias.filter(([origen]) => !fs.existsSync(path.join(modulos, origen)));
  if (faltan.length > 0) {
    console.warn(`[public] no se encontró en node_modules: ${faltan.map(([o]) => o).join(', ')}`);
    return;
  }
  for (const [origen, destino] of copias) {
    fs.mkdirSync(path.dirname(path.join(publico, destino)), { recursive: true });
    fs.copyFileSync(path.join(modulos, origen), path.join(publico, destino));
  }
  console.log(`[public] copiados: ${copias.map(([, d]) => d).join(', ')}`);
}

// Las pruebas leen la lista sin copiar nada.
if (require.main === module) copiar();

module.exports = { copias };

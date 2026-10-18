// Copia el worker de MapLibre GL JS a public/ para que la web lo sirva como
// módulo. Metro no sirve archivos de node_modules como workers, así que la app
// web le indica esta URL con setWorkerUrl(). Corre en postinstall.
const fs = require('node:fs');
const path = require('node:path');

const origen = path.join(
  __dirname,
  '..',
  'node_modules',
  'maplibre-gl',
  'dist',
  'maplibre-gl-worker.mjs',
);
const destinoDir = path.join(__dirname, '..', 'public');
const destino = path.join(destinoDir, 'maplibre-gl-worker.mjs');

if (!fs.existsSync(origen)) {
  console.warn('[maplibre] no se encontró el worker en node_modules; ¿faltó npm install?');
  process.exit(0);
}
fs.mkdirSync(destinoDir, { recursive: true });
fs.copyFileSync(origen, destino);
console.log('[maplibre] worker copiado a public/maplibre-gl-worker.mjs');

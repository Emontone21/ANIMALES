// Servidor estático de las pruebas de punta a punta: sirve el build web de
// e2e/.dist (lo arma e2e/global-setup.ts) en http://127.0.0.1:4173, como lo
// sirve Vercel: los archivos tal cual y, para las rutas de la app
// (/animal/<id>, /perfil…), index.html. Node puro, sin dependencias.
//
// Uso: node e2e/servidor.mjs [puerto]
//
// Playwright lo levanta antes que el global-setup (webServer va primero), así
// que tiene que andar aunque el build todavía no exista: lee cada archivo al
// pedirlo y /__salud responde siempre, para que Playwright sepa que arrancó.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '.dist');
const PUERTO = Number(process.argv[2] ?? 4173);
const HOST = '127.0.0.1';

/** Los tipos de lo que genera `expo export -p web` y lo que copia public/. */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  // El worker de MapLibre es un módulo: con otro tipo, el navegador no lo carga.
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Lo que lleva un hash en el nombre se guarda un año, como en vercel.json. */
function cacheDe(ruta) {
  return ruta.startsWith('/_expo/static/') || ruta.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}

async function esArchivo(ruta) {
  try {
    return (await stat(ruta)).isFile();
  } catch {
    return false;
  }
}

function responderTexto(respuesta, estado, texto) {
  respuesta.writeHead(estado, { 'Content-Type': 'text/plain; charset=utf-8' });
  respuesta.end(texto);
}

const servidor = createServer(async (pedido, respuesta) => {
  if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
    respuesta.writeHead(405, { Allow: 'GET, HEAD' });
    respuesta.end();
    return;
  }

  let ruta;
  try {
    ruta = decodeURIComponent(new URL(pedido.url ?? '/', `http://${HOST}`).pathname);
  } catch {
    responderTexto(respuesta, 400, 'Ruta inválida');
    return;
  }

  if (ruta === '/__salud') {
    responderTexto(respuesta, 200, 'ok');
    return;
  }

  // Nada fuera de e2e/.dist, aunque la ruta traiga "..".
  const pedidoEnDisco = path.resolve(DIST, `.${ruta}`);
  if (pedidoEnDisco !== DIST && !pedidoEnDisco.startsWith(DIST + path.sep)) {
    responderTexto(respuesta, 403, 'Fuera del build');
    return;
  }

  const indice = path.join(DIST, 'index.html');
  if (!(await esArchivo(indice))) {
    responderTexto(
      respuesta,
      503,
      'Todavía no está el build web en e2e/.dist: lo arma e2e/global-setup.ts al correr las pruebas.',
    );
    return;
  }

  let archivo = pedidoEnDisco;
  if (!(await esArchivo(archivo))) {
    // Una ruta de la app (sin extensión) es la página única; un archivo que falta, 404.
    if (path.extname(ruta) !== '') {
      responderTexto(respuesta, 404, 'No existe');
      return;
    }
    archivo = indice;
  }

  const tipo = TIPOS[path.extname(archivo).toLowerCase()] ?? 'application/octet-stream';
  respuesta.writeHead(200, {
    'Content-Type': tipo,
    'Cache-Control': archivo === indice ? 'no-cache' : cacheDe(ruta),
    'X-Content-Type-Options': 'nosniff',
  });
  if (pedido.method === 'HEAD') {
    respuesta.end();
    return;
  }
  createReadStream(archivo)
    .on('error', () => respuesta.destroy())
    .pipe(respuesta);
});

servidor.listen(PUERTO, HOST, () => {
  console.log(`[e2e] sirviendo ${DIST} en http://${HOST}:${PUERTO}`);
});

// Playwright lo corta al terminar. Las conexiones abiertas del navegador no lo demoran.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
    servidor.closeAllConnections();
  });
}

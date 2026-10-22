import logoClaro from '@/assets/marca/spot-logo.svg';
import logoOscuro from '@/assets/marca/spot-logo-oscuro.svg';
import marcaClara from '@/assets/marca/spot-marca.svg';
import marcaOscura from '@/assets/marca/spot-marca-oscuro.svg';
import type { Esquema } from '@/constants/tema';
import {
  colorDominante,
  disenioDe,
  type DisenioHistoria,
  type FuenteHistoria,
  partirEnLineas,
  type TextoEnHistoria,
} from '@/features/historias/disenio';
import { activarFuentesWeb } from '@/lib/fuentesWeb';

/**
 * Dibuja la historia en un canvas, en el celular: sin servidor. Va en el
 * bloque aparte de la hoja (HojaHistoria), así no suma a la carga inicial.
 *
 * La foto se baja con fetch (CORS) y se dibuja desde un ImageBitmap: el canvas
 * no queda "sucio" y se puede exportar. Si no se puede (una foto de otro
 * sitio que no lo permite, sin red), la historia sale igual, con el color de
 * la especie y la chapita en el recuadro.
 */

const ESPERA_FOTO_MS = 10_000;
const CALIDAD = 0.92;

/** En web, un SVG importado es { uri, width, height } (src/types/svg.d.ts). */
function uriDe(recurso: number | { uri?: string }): string {
  return typeof recurso === 'number' ? '' : (recurso.uri ?? '');
}

async function cargarFoto(url: string): Promise<ImageBitmap> {
  const respuesta = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    signal: AbortSignal.timeout(ESPERA_FOTO_MS),
  });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  const archivo = await respuesta.blob();
  if (!archivo.type.startsWith('image/')) throw new Error('No es una imagen');
  return createImageBitmap(archivo);
}

/** Los SVG de assets/marca, del mismo sitio: no ensucian el canvas. */
function cargarImagen(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No cargó la imagen'));
    imagen.src = uri;
  });
}

/** El color dominante, de la foto achicada a 48 × 48 (alcanza y es rápido). */
function colorDeLaFoto(foto: ImageBitmap) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 48;
  lienzo.height = 48;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(foto, 0, 0, 48, 48);
  return colorDominante(ctx.getImageData(0, 0, 48, 48).data);
}

async function cargarFuentes(d: DisenioHistoria): Promise<void> {
  activarFuentesWeb();
  const pedidos = [d.etiqueta.texto, ...d.textos].map((x) =>
    document.fonts.load(`${x.tamanio}px "${x.familia}"`),
  );
  await Promise.all(pedidos).catch(() => {});
}

function rectanguloRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number,
) {
  ctx.beginPath();
  // roundRect llegó en Safari 16 y Chrome 99: antes, con arcos.
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, ancho, alto, radio);
    return;
  }
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}

/** Achica el texto hasta que entre; si ni así, lo corta con "…". */
function textoQueEntra(ctx: CanvasRenderingContext2D, x: TextoEnHistoria) {
  let tamanio = x.tamanio;
  ctx.font = `${tamanio}px "${x.familia}"`;
  while (ctx.measureText(x.texto).width > x.maxAncho && tamanio > x.tamanioMinimo) {
    tamanio -= 2;
    ctx.font = `${tamanio}px "${x.familia}"`;
  }
  let texto = x.texto;
  while (ctx.measureText(texto).width > x.maxAncho && texto.length > 1) {
    texto = `${texto.slice(0, -2).trimEnd()}…`;
  }
  return texto;
}

function escribir(ctx: CanvasRenderingContext2D, x: TextoEnHistoria) {
  ctx.fillStyle = x.color;
  ctx.textBaseline = 'alphabetic';
  if (x.lineas) {
    // En varias líneas, con el tamaño fijo: se parte por palabras y la última se corta con "…".
    ctx.font = `${x.tamanio}px "${x.familia}"`;
    const lineas = partirEnLineas(
      x.texto,
      x.maxAncho,
      x.lineas.maximo,
      (texto) => ctx.measureText(texto).width,
    );
    lineas.forEach((linea, i) => ctx.fillText(linea, x.x, x.y + i * (x.lineas?.interlineado ?? 0)));
    return;
  }
  ctx.fillText(textoQueEntra(ctx, x), x.x, x.y);
}

function dibujarFoto(
  ctx: CanvasRenderingContext2D,
  d: DisenioHistoria,
  foto: ImageBitmap | null,
  marca: HTMLImageElement | null,
) {
  const { x, y, ancho, alto, radio, colorVacio } = d.foto;
  ctx.save();
  rectanguloRedondeado(ctx, x, y, ancho, alto, radio);
  ctx.clip();
  ctx.fillStyle = colorVacio;
  ctx.fillRect(x, y, ancho, alto);
  if (foto) {
    // Como "cover": llena el recuadro, recortando lo que sobra, centrada.
    const escala = Math.max(ancho / foto.width, alto / foto.height);
    const w = foto.width * escala;
    const h = foto.height * escala;
    ctx.drawImage(foto, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
  } else if (marca) {
    const w = 240;
    const h = (w * marca.naturalHeight) / (marca.naturalWidth || 1);
    ctx.drawImage(marca, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
  }
  ctx.restore();
}

function dibujarEtiqueta(ctx: CanvasRenderingContext2D, d: DisenioHistoria) {
  const e = d.etiqueta;
  ctx.font = `${e.texto.tamanio}px "${e.texto.familia}"`;
  const anchoTexto = ctx.measureText(e.texto.texto).width;
  const separacion = 16;
  const ancho = e.relleno * 2 + e.radioPunto * 2 + separacion + anchoTexto;
  ctx.fillStyle = e.color;
  rectanguloRedondeado(ctx, e.x, e.y, ancho, e.alto, e.alto / 2);
  ctx.fill();
  ctx.fillStyle = e.colorPunto;
  ctx.beginPath();
  ctx.arc(e.x + e.relleno + e.radioPunto, e.y + e.alto / 2, e.radioPunto, 0, Math.PI * 2);
  ctx.fill();
  escribir(ctx, { ...e.texto, x: e.x + e.relleno + e.radioPunto * 2 + separacion });
}

export type Historia = { archivo: Blob; disenio: DisenioHistoria };

export async function generarHistoria(
  fuente: FuenteHistoria,
  urlDeLaFoto: string | null,
  esquema: Esquema,
): Promise<Historia> {
  const foto = urlDeLaFoto ? await cargarFoto(urlDeLaFoto).catch(() => null) : null;
  const d = disenioDe(fuente, esquema, foto ? colorDeLaFoto(foto) : null);
  const [logo, marca] = await Promise.all([
    cargarImagen(uriDe(esquema === 'claro' ? logoClaro : logoOscuro)).catch(() => null),
    d.conFoto
      ? null
      : cargarImagen(uriDe(esquema === 'claro' ? marcaClara : marcaOscura)).catch(() => null),
    cargarFuentes(d),
  ]);

  const lienzo = document.createElement('canvas');
  lienzo.width = d.ancho;
  lienzo.height = d.alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');

  ctx.fillStyle = d.fondo;
  ctx.fillRect(0, 0, d.ancho, d.alto);
  dibujarEtiqueta(ctx, d);
  dibujarFoto(ctx, d, d.conFoto ? foto : null, marca);
  for (const texto of d.textos) escribir(ctx, texto);
  if (logo) ctx.drawImage(logo, d.logo.x, d.logo.y, d.logo.ancho, d.logo.alto);
  foto?.close();

  const archivo = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  );
  if (!archivo) throw new Error('No se pudo exportar la imagen');
  return { archivo, disenio: d };
}

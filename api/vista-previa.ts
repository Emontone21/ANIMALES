/**
 * Vista previa del link de un caso (/animal/<id>) en WhatsApp, Facebook,
 * Telegram y otros. Es la única pieza de servidor propia del proyecto (ver
 * docs/DECISIONES.md): vercel.json manda acá solo a los bots de vista previa;
 * las personas reciben el index.html estático de siempre.
 *
 * Devuelve el index.html de la app con las etiquetas Open Graph y Twitter del
 * caso. Lee el caso con la clave anon, como la app. Si no existe, está oculto o
 * se unió a otro, usa las genéricas. Nunca pone datos personales: ni el
 * contacto, ni quién publicó, ni dónde está. Por eso tampoco usa la
 * descripción libre del caso, donde alguien pudo haber escrito un teléfono.
 *
 * Sin dependencias: fetch y Response del runtime. Importa con rutas relativas
 * los mismos textos, URLs y miniaturas que usa la app.
 */
import { t } from '../src/i18n/es-UY';
import { datosParaCompartir, linkDelCaso } from '../src/lib/compartir';
import { ENV } from '../src/lib/env';
import { LADO_MINIATURA, urlFoto, urlMiniatura } from '../src/lib/imagenes';
import type { EstadoAnimal, Especie, Tamanio, TipoReporte } from '../src/types/dominio';

/** Columnas de animales que hacen falta. Ninguna con datos de quien publicó. */
const COLUMNAS =
  'id,tipo_reporte,estado,nombre,especie,color,tamanio,tiene_collar,foto_principal_path,oculto';
const ID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESPERA_MS = 2500;
/** El index.html cambia solo con cada deploy: se guarda unos minutos en memoria. */
const VIDA_PLANTILLA_MS = 5 * 60_000;

type Caso = {
  id: string;
  tipo_reporte: TipoReporte;
  estado: EstadoAnimal;
  nombre: string | null;
  especie: Especie;
  color: string | null;
  tamanio: Tamanio | null;
  tiene_collar: boolean;
  foto_principal_path: string;
  oculto: boolean;
};

type Etiquetas = {
  titulo: string;
  descripcion: string;
  url: string;
  imagen: { url: string; lado: number | null } | null;
};

let plantilla: { html: string; hasta: number } | null = null;

export async function GET(request: Request): Promise<Response> {
  const pedido = new URL(request.url);
  const id = idDelPedido(pedido);
  const [html, caso] = await Promise.all([leerPlantilla(pedido.origin), leerCaso(id)]);
  const etiquetas = caso ? await etiquetasDelCaso(caso) : etiquetasGenericas(id);

  return new Response(insertarEtiquetas(html ?? PLANTILLA_MINIMA, etiquetas), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Un rato en la CDN: una edición se ve en la vista previa a los pocos
      // minutos. Sin la plantilla de la app, no se guarda.
      'cache-control': html ? 'public, max-age=0, s-maxage=300' : 'no-store',
    },
  });
}

/** Algunos bots preguntan primero con HEAD: mismas cabeceras, sin cuerpo. */
export async function HEAD(request: Request): Promise<Response> {
  const respuesta = await GET(request);
  return new Response(null, { status: respuesta.status, headers: respuesta.headers });
}

/** El id llega como ?id= (rewrite de vercel.json) o en la ruta /animal/<id>. */
function idDelPedido(pedido: URL): string | null {
  const id =
    pedido.searchParams.get('id') ?? /^\/animal\/([^/]+)\/?$/.exec(pedido.pathname)?.[1] ?? null;
  return id && ID_VALIDO.test(id) ? id.toLowerCase() : null;
}

/**
 * El index.html publicado en este mismo deploy. Se pide con un user-agent que
 * no es de bot, así vercel.json no lo vuelve a mandar a esta función.
 */
async function leerPlantilla(origen: string): Promise<string | null> {
  if (plantilla && plantilla.hasta > Date.now()) return plantilla.html;
  try {
    const respuesta = await fetch(`${origen}/`, {
      headers: { 'user-agent': 'encontrados-vista-previa' },
      // Una preview con la protección de Vercel redirige al login: eso no sirve.
      redirect: 'manual',
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    const html = respuesta.ok ? await respuesta.text() : '';
    // Tiene que ser el index.html de la app (public/index.html), no otra página.
    if (!html.includes('<div id="root">') || !html.includes('</head>')) return null;
    plantilla = { html, hasta: Date.now() + VIDA_PLANTILLA_MS };
    return html;
  } catch {
    return null;
  }
}

async function leerCaso(id: string | null): Promise<Caso | null> {
  if (!id) return null;
  try {
    const url = `${ENV.supabaseUrl.replace(/\/+$/, '')}/rest/v1/animales?id=eq.${id}&select=${COLUMNAS}`;
    const respuesta = await fetch(url, {
      headers: { apikey: ENV.supabaseAnonKey, authorization: `Bearer ${ENV.supabaseAnonKey}` },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!respuesta.ok) return null;
    const [caso] = (await respuesta.json()) as Caso[];
    // Oculto por moderación o unido a otro caso: como si no existiera.
    if (!caso || caso.oculto || caso.estado === 'vinculado') return null;
    return caso;
  } catch {
    return null;
  }
}

async function etiquetasDelCaso(caso: Caso): Promise<Etiquetas> {
  const datos = datosParaCompartir(caso);
  return {
    titulo: t.compartir.vistaPrevia.titulo(datos),
    descripcion: t.compartir.vistaPrevia.descripcion(datos),
    url: linkDelCaso(caso.id),
    imagen: await imagenDelCaso(caso.foto_principal_path),
  };
}

function etiquetasGenericas(id: string | null): Etiquetas {
  return {
    titulo: t.compartir.vistaPrevia.tituloGenerico,
    descripcion: t.compartir.vistaPrevia.descripcionGenerica,
    url: id ? linkDelCaso(id) : ENV.siteUrl,
    imagen: null,
  };
}

/** La miniatura de 320; si no existe (fotos de antes de la Fase 8), la original. */
async function imagenDelCaso(ruta: string): Promise<Etiquetas['imagen']> {
  const miniatura = urlMiniatura(ruta);
  const original = urlFoto(ruta);
  if (miniatura === original) return { url: original, lado: null };
  try {
    const respuesta = await fetch(miniatura, {
      method: 'HEAD',
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (respuesta.ok) return { url: miniatura, lado: LADO_MINIATURA };
  } catch {
    // Sigue con la original.
  }
  return { url: original, lado: null };
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Reemplaza el <title> de la app por el del caso y suma las etiquetas en el <head>. */
function insertarEtiquetas(html: string, e: Etiquetas): string {
  const meta = (atributo: 'name' | 'property', clave: string, valor: string) =>
    `<meta ${atributo}="${clave}" content="${escapar(valor)}" />`;
  const etiquetas = [
    // Las genéricas ya se llaman como la app: no se repite el nombre.
    `<title>${escapar(e.titulo === t.app.nombre ? e.titulo : `${e.titulo} · ${t.app.nombre}`)}</title>`,
    meta('name', 'description', e.descripcion),
    `<link rel="canonical" href="${escapar(e.url)}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', t.app.nombre),
    meta('property', 'og:locale', 'es_UY'),
    meta('property', 'og:title', e.titulo),
    meta('property', 'og:description', e.descripcion),
    meta('property', 'og:url', e.url),
    ...(e.imagen
      ? [
          meta('property', 'og:image', e.imagen.url),
          meta('property', 'og:image:alt', e.titulo),
          ...(e.imagen.lado
            ? [
                meta('property', 'og:image:width', String(e.imagen.lado)),
                meta('property', 'og:image:height', String(e.imagen.lado)),
              ]
            : []),
        ]
      : []),
    // "summary": la imagen chica y cuadrada, como la miniatura.
    meta('name', 'twitter:card', 'summary'),
    meta('name', 'twitter:title', e.titulo),
    meta('name', 'twitter:description', e.descripcion),
    ...(e.imagen ? [meta('name', 'twitter:image', e.imagen.url)] : []),
  ].join('\n    ');

  const sinTitulo = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  return sinTitulo.replace('</head>', `\n    ${etiquetas}\n  </head>`);
}

/** Si no se pudo leer el index.html de la app: lo justo para la vista previa. */
const PLANTILLA_MINIMA = `<!doctype html>
<html lang="es-UY">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body></body>
</html>`;

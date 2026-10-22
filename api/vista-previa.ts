/**
 * Vista previa del link de un caso (/animal/<id>) y de la historia de un
 * reencuentro (/reencuentros/<id>) en WhatsApp, Facebook, Telegram y otros.
 * Es la única pieza de servidor propia del proyecto (ver docs/DECISIONES.md):
 * vercel.json manda acá solo a los bots de vista previa; las personas reciben
 * el index.html estático de siempre.
 *
 * Devuelve el index.html de la app con las etiquetas Open Graph y Twitter del
 * caso. Lee el caso de animales_detalle con la clave pública de la app (la
 * publishable o, de respaldo, la anon): lo mismo que ve alguien sin cuenta. Si
 * no existe, está oculto o se unió a otro, usa las genéricas. Nunca pone datos
 * personales: ni el contacto, ni quién publicó, ni dónde está. Por eso tampoco
 * usa la descripción libre del caso, donde alguien pudo haber escrito un
 * teléfono, ni un color con números. De un caso reunido, solo lo básico (el
 * nombre si la familia lo mostró y la especie): la base no manda más (0027).
 * De una historia, solo lo que muestra el muro: el nombre (si la familia
 * quiso), la especie, los días y la foto; ni siquiera la frase.
 *
 * Sin dependencias: fetch y Response del runtime. Importa con rutas relativas
 * los mismos textos, URLs y miniaturas que usa la app.
 */
import { t } from '../src/i18n/es-UY';
import { datosParaCompartir, linkDeHistoria, linkDelCaso } from '../src/lib/compartir';
import { ENV, esClaveNueva } from '../src/lib/env';
import { LADO_MINIATURA, urlFoto, urlMiniatura } from '../src/lib/imagenes';
import type { EstadoAnimal, Especie, Tamanio, TipoReporte } from '../src/types/dominio';

/** Columnas de animales_detalle que hacen falta. Ninguna con datos de quien publicó. */
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
  /** null en lo básico de un caso reunido. */
  tiene_collar: boolean | null;
  foto_principal_path: string;
  oculto: boolean;
};

/** Lo que devuelve historia_reencuentro: lo mismo que el muro, más si está oculta. */
type Historia = {
  animal_id: string;
  nombre: string | null;
  especie: Especie;
  foto_path: string;
  dias: number;
  oculta: boolean;
};

type Pedido = { tipo: 'caso' | 'historia'; id: string } | null;

type Etiquetas = {
  titulo: string;
  descripcion: string;
  url: string;
  imagen: { url: string; lado: number | null } | null;
};

let plantilla: { html: string; hasta: number } | null = null;

const GENERICOS: string[] = [t.app.nombre, t.reencuentros.vistaPrevia.tituloGenerico];

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pedido = queSePide(url);
  const [html, etiquetas] = await Promise.all([leerPlantilla(url.origin), etiquetasDe(pedido)]);

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

/**
 * El id llega como ?id= o ?historia= (rewrites de vercel.json) o en la ruta
 * (/animal/<id> o /reencuentros/<id>). Si llega más de uno (/animal/<A>?id=<B>,
 * o un caso y una historia), ninguno: la vista previa podría mostrar una cosa
 * y el link abrir otra (auditoría 2, S-B7).
 */
function queSePide(url: URL): Pedido {
  const casos = [
    ...url.searchParams.getAll('id'),
    ...[/^\/animal\/([^/]+)\/?$/.exec(url.pathname)?.[1]].filter((x): x is string => !!x),
  ];
  const historias = [
    ...url.searchParams.getAll('historia'),
    ...[/^\/reencuentros\/([^/]+)\/?$/.exec(url.pathname)?.[1]].filter((x): x is string => !!x),
  ];
  // La ruta y el parámetro del rewrite son el mismo id: cuenta una vez.
  const unicos = (ids: string[]) => [...new Set(ids.map((x) => x.toLowerCase()))];
  const [caso, historia] = [unicos(casos), unicos(historias)];
  if (caso.length + historia.length !== 1) return null;
  const id = caso[0] ?? historia[0];
  if (!ID_VALIDO.test(id)) return null;
  return { tipo: caso.length === 1 ? 'caso' : 'historia', id };
}

async function etiquetasDe(pedido: Pedido): Promise<Etiquetas> {
  if (pedido?.tipo === 'historia') {
    const historia = await leerHistoria(pedido.id);
    return historia ? etiquetasDeHistoria(historia) : etiquetasGenericasDeHistoria(pedido.id);
  }
  const id = pedido?.id ?? null;
  const caso = await leerCaso(id);
  return caso ? etiquetasDelCaso(caso) : etiquetasGenericas(id);
}

/**
 * El index.html publicado en este mismo deploy. Se pide con un user-agent que
 * no es de bot, así vercel.json no lo vuelve a mandar a esta función.
 */
async function leerPlantilla(origen: string): Promise<string | null> {
  if (plantilla && plantilla.hasta > Date.now()) return plantilla.html;
  try {
    const respuesta = await fetch(`${origen}/`, {
      headers: { 'user-agent': 'spot-vista-previa' },
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

/**
 * Headers para leer como la app sin sesión: la publishable va solo en apikey
 * (no es un JWT); la anon legacy, también en Authorization.
 */
export function encabezadosDeLectura(clave: string): Record<string, string> {
  return esClaveNueva(clave)
    ? { apikey: clave }
    : { apikey: clave, authorization: `Bearer ${clave}` };
}

async function leerCaso(id: string | null): Promise<Caso | null> {
  if (!id) return null;
  try {
    const url = `${ENV.supabaseUrl.replace(/\/+$/, '')}/rest/v1/animales_detalle?id=eq.${id}&select=${COLUMNAS}`;
    const respuesta = await fetch(url, {
      headers: encabezadosDeLectura(ENV.supabaseKey),
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

/** La historia de un reencuentro, por la misma RPC que usa el muro (solo lo público). */
async function leerHistoria(id: string): Promise<Historia | null> {
  try {
    const url = `${ENV.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/historia_reencuentro`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { ...encabezadosDeLectura(ENV.supabaseKey), 'content-type': 'application/json' },
      body: JSON.stringify({ p_animal_id: id }),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!respuesta.ok) return null;
    const [historia] = (await respuesta.json()) as Historia[];
    // Sin cuenta nunca llega una oculta; si llegara, como si no existiera.
    if (!historia || historia.oculta) return null;
    return historia;
  } catch {
    return null;
  }
}

async function etiquetasDeHistoria(historia: Historia): Promise<Etiquetas> {
  const titulo = t.reencuentros.tituloHistoria(historia.nombre, historia.especie);
  return {
    titulo: t.reencuentros.vistaPrevia.titulo(titulo),
    descripcion: t.reencuentros.vistaPrevia.descripcion(t.reencuentros.dias(historia.dias)),
    url: linkDeHistoria(historia.animal_id),
    imagen: await imagenDelCaso(historia.foto_path),
  };
}

function etiquetasGenericasDeHistoria(id: string): Etiquetas {
  return {
    titulo: t.reencuentros.vistaPrevia.tituloGenerico,
    descripcion: t.reencuentros.vistaPrevia.descripcionGenerica,
    url: linkDeHistoria(id),
    imagen: null,
  };
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

/**
 * Reemplaza el <title> y la descripción genérica de la app por los del caso y
 * suma las etiquetas en el <head>.
 */
function insertarEtiquetas(html: string, e: Etiquetas): string {
  const meta = (atributo: 'name' | 'property', clave: string, valor: string) =>
    `<meta ${atributo}="${clave}" content="${escapar(valor)}" />`;
  const etiquetas = [
    // Las genéricas ya nombran la app: no se repite el nombre.
    `<title>${escapar(GENERICOS.includes(e.titulo) ? e.titulo : `${e.titulo} · ${t.app.nombre}`)}</title>`,
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

  const sinGenericas = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '');
  // Con una función, el texto se inserta tal cual: con un texto de reemplazo,
  // "$`" o "$&" en un nombre metería pedazos del <head> (auditoría 2, S-B1).
  return sinGenericas.replace('</head>', () => `\n    ${etiquetas}\n  </head>`);
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

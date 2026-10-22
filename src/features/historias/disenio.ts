/**
 * La historia para compartir (docs/DISENO.md, 6.18): una imagen de 1080 × 1920
 * que se arma en el celular. Acá está todo lo que se decide sin el navegador
 * (qué textos lleva, dónde va cada cosa y de qué color), para probarlo
 * (__tests__/historia.test.ts); generarHistoria.web.ts solo lo dibuja.
 *
 * Lleva la foto, "SE PERDIÓ" o "ENCONTRADO", el nombre (o la especie), la
 * fecha, el logo y "Ayudá a encontrarlo en Spot". Nunca contactos, quién lo
 * publicó, la descripción libre ni dónde: los datos entran por
 * datosDeHistoria, que toma solo lo que se puede mostrar.
 */

import { ColorHistoria, type Esquema, FAMILIAS, paletas } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import { colorParaCompartir } from '@/lib/compartir';
import { contraste } from '@/lib/contraste';
import { elDiaDelMes } from '@/lib/fechas';
import type { Especie, Tamanio, TipoReporte } from '@/types/dominio';

export const ANCHO = 1080;
export const ALTO = 1920;
/** Lo mínimo para el texto sobre el fondo; DISENO pide más de 4,5:1. */
export const CONTRASTE_FONDO = 5.5;

export type Rgb = [number, number, number];

/** Lo único del caso que entra en la imagen. */
export type DatosHistoria = {
  tipo: TipoReporte;
  nombre: string | null;
  especie: Especie;
  color: string | null;
  tamanio: Tamanio | null;
  /** Cuándo se perdió o cuándo lo encontraron (ISO). */
  fecha: string;
};

/**
 * `encontradoEn`: cuándo lo vio quien lo encontró (su primer aviso); si no se
 * sabe, cuándo se publicó.
 */
export function datosDeHistoria(
  caso: {
    tipo_reporte: TipoReporte;
    nombre: string | null;
    especie: Especie;
    color: string | null;
    tamanio: Tamanio | null;
    perdido_desde?: string | null;
    created_at: string;
  },
  encontradoEn?: string | null,
): DatosHistoria {
  const perdido = caso.tipo_reporte === 'perdido';
  return {
    tipo: caso.tipo_reporte,
    nombre: nombreParaHistoria(caso.nombre),
    especie: caso.especie,
    color: colorParaCompartir(caso.color),
    tamanio: caso.tamanio,
    fecha: (perdido ? caso.perdido_desde : encontradoEn) ?? caso.created_at,
  };
}

/**
 * El nombre lo escribe la familia: con números, una arroba o un link (podría
 * ser un contacto) va la especie. Hasta 30 caracteres.
 */
export function nombreParaHistoria(nombre: string | null): string | null {
  const limpio = nombre?.replace(/\s+/g, ' ').trim() ?? '';
  if (!limpio || limpio.length > 30) return null;
  if (/\d|@|https?:|www\.|\.com/i.test(limpio)) return null;
  return limpio;
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-UY') + texto.slice(1);
}

export type TextosHistoria = {
  etiqueta: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  ayuda: string;
};

export function textosDeHistoria(d: DatosHistoria): TextosHistoria {
  const detalles = [d.color, d.tamanio ? t.tamanio[d.tamanio].toLowerCase() : null].filter(
    (dato): dato is string => !!dato,
  );
  return {
    etiqueta: t.historia.etiqueta[d.tipo],
    titulo: d.nombre ?? t.especie[d.especie],
    // Con nombre, qué animal es ("Perro marrón"); sin nombre el título ya es la especie.
    descripcion: d.nombre
      ? t.animal.tituloCorto(d.especie, d.color, d.tamanio)
      : detalles.length > 0
        ? mayuscula(detalles.join(', '))
        : null,
    fecha: t.historia.fecha[d.tipo](elDiaDelMes(d.fecha)),
    ayuda: t.historia.ayuda[d.tipo],
  };
}

// --- Colores -------------------------------------------------------------------

export function deHex(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

export function aHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

function mezclar(a: Rgb, b: Rgb, cuanto: number): Rgb {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * cuanto) as Rgb;
}

/**
 * El color que más se ve en la foto, como las tapas de Spotify: cada píxel va
 * a un grupo de colores parecidos (4 bits por canal) y pesa más cuanto más
 * saturado; gana el grupo más pesado y se devuelve su promedio. Recibe los
 * píxeles RGBA de la foto achicada. null si no hay píxeles visibles.
 */
export function colorDominante(pixeles: ArrayLike<number>): Rgb | null {
  const grupos = new Map<number, { peso: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixeles.length; i += 4) {
    if (pixeles[i + 3] < 128) continue;
    const r = pixeles[i];
    const g = pixeles[i + 1];
    const b = pixeles[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturacion = max === 0 ? 0 : (max - min) / max;
    // Lo casi blanco y lo casi negro (cielo, sombras) cuenta poco.
    const peso = (max < 24 || min > 232 ? 0.2 : 1) * (1 + 3 * saturacion);
    const clave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const grupo = grupos.get(clave) ?? { peso: 0, r: 0, g: 0, b: 0 };
    grupo.peso += peso;
    grupo.r += r * peso;
    grupo.g += g * peso;
    grupo.b += b * peso;
    grupos.set(clave, grupo);
  }
  let mejor: { peso: number; r: number; g: number; b: number } | null = null;
  for (const grupo of grupos.values()) {
    if (!mejor || grupo.peso > mejor.peso) mejor = grupo;
  }
  if (!mejor || mejor.peso === 0) return null;
  const { peso, r, g, b } = mejor;
  return [Math.round(r / peso), Math.round(g / peso), Math.round(b / peso)];
}

/**
 * El fondo: el color de la foto (o de la especie) llevado hacia la superficie
 * del claro o el fondo del oscuro, de a poco, hasta que el texto del esquema
 * tenga al menos CONTRASTE_FONDO. Así queda el color más vivo que se lee.
 * Siempre se mueve un mínimo (MEZCLA_MINIMA): si no, con una foto que ya se lee
 * el fondo sería el de la foto y el recuadro se perdería.
 */
export const MEZCLA_MINIMA: Record<Esquema, number> = { claro: 0.35, oscuro: 0.25 };

export function fondoDeHistoria(base: Rgb, esquema: Esquema): string {
  const p = paletas[esquema];
  const destino = deHex(esquema === 'claro' ? p.superficie : p.fondo);
  for (let paso = Math.round(MEZCLA_MINIMA[esquema] * 20); paso <= 20; paso++) {
    const color = aHex(mezclar(base, destino, paso / 20));
    if (contraste(color, p.texto) >= CONTRASTE_FONDO) return color;
  }
  return aHex(destino);
}

// --- Dónde va cada cosa ---------------------------------------------------------

export type TextoEnHistoria = {
  texto: string;
  x: number;
  /** Línea de base. */
  y: number;
  familia: string;
  tamanio: number;
  /** Si no entra en maxAncho se achica hasta acá; después, se corta con "…". */
  tamanioMinimo: number;
  maxAncho: number;
  color: string;
  /** El color que tiene detrás (para el contraste). */
  sobre: string;
};

export type DisenioHistoria = {
  ancho: number;
  alto: number;
  esquema: Esquema;
  fondo: string;
  /** La etiqueta "SE PERDIÓ" o "ENCONTRADO": una cápsula con un punto del color del tipo. */
  etiqueta: {
    x: number;
    y: number;
    alto: number;
    relleno: number;
    radioPunto: number;
    color: string;
    colorPunto: string;
    texto: TextoEnHistoria;
  };
  /** La foto, recortada para llenar el recuadro. Sin foto, el recuadro con la chapita. */
  foto: { x: number; y: number; ancho: number; alto: number; radio: number; colorVacio: string };
  conFoto: boolean;
  textos: TextoEnHistoria[];
  /** El logo completo de assets/marca (274 × 107), del esquema. */
  logo: { x: number; y: number; ancho: number; alto: number };
};

const MARGEN = 80;
const ANCHO_UTIL = ANCHO - 2 * MARGEN;
const ANCHO_LOGO = 288;

/**
 * Instagram tapa arriba (unos 200 px) y abajo (unos 220): lo importante va
 * entre los dos.
 */
export function disenioHistoria(
  datos: DatosHistoria,
  esquema: Esquema,
  colorFoto: Rgb | null,
): DisenioHistoria {
  const p = paletas[esquema];
  const fondo = fondoDeHistoria(colorFoto ?? deHex(ColorHistoria[datos.especie]), esquema);
  const textos = textosDeHistoria(datos);
  const perdido = datos.tipo === 'perdido';
  const texto = (
    valor: string,
    y: number,
    familia: string,
    tamanio: number,
    tamanioMinimo = tamanio,
  ): TextoEnHistoria => ({
    texto: valor,
    x: MARGEN,
    y,
    familia,
    tamanio,
    tamanioMinimo,
    maxAncho: ANCHO_UTIL,
    color: p.texto,
    sobre: fondo,
  });

  return {
    ancho: ANCHO,
    alto: ALTO,
    esquema,
    fondo,
    etiqueta: {
      x: MARGEN,
      y: 214,
      alto: 84,
      relleno: 36,
      radioPunto: 12,
      color: p.superficie,
      colorPunto: perdido ? p.perdido : p.encontrado,
      texto: {
        texto: textos.etiqueta,
        x: MARGEN,
        y: 214 + 56,
        familia: FAMILIAS.negrita,
        tamanio: 38,
        tamanioMinimo: 38,
        maxAncho: ANCHO_UTIL,
        color: perdido ? p.textoPerdido : p.textoEncontrado,
        sobre: p.superficie,
      },
    },
    foto: {
      x: MARGEN,
      y: 334,
      ancho: ANCHO_UTIL,
      alto: 856,
      radio: 64,
      colorVacio: p.superficieSuave,
    },
    conFoto: colorFoto !== null,
    textos: [
      texto(textos.titulo, 1306, FAMILIAS.titulo, 112, 64),
      ...(textos.descripcion
        ? [texto(textos.descripcion, 1378, FAMILIAS.seminegrita, 46, 36)]
        : []),
      texto(textos.fecha, textos.descripcion ? 1444 : 1378, FAMILIAS.regular, 42, 34),
      texto(textos.ayuda, 1566, FAMILIAS.negrita, 44, 34),
    ],
    logo: { x: MARGEN, y: 1600, ancho: ANCHO_LOGO, alto: Math.round((ANCHO_LOGO * 107) / 274) },
  };
}

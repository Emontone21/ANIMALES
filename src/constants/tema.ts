import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import type { Especie, EstadoAnimal, TipoReporte } from '@/types/dominio';

/**
 * Tema "Calma oliva" (ver docs/DISENO.md). Único archivo con colores escritos:
 * los componentes toman la paleta activa con useTema() o useEstilos().
 */

// --- Paletas ----------------------------------------------------------------

type PaletaBase = {
  fondo: string;
  superficie: string;
  superficieSuave: string;
  borde: string;
  /** Contorno de campos y del recuadro de la foto: 3:1 contra superficie y fondo. */
  bordeCampo: string;
  texto: string;
  textoCuerpo: string;
  textoSecundario: string;
  primario: string;
  primarioPresionado: string;
  textoSobrePrimario: string;
  primarioSuave: string;
  textoPrimarioSuave: string;
  inverso: string;
  textoInverso: string;
  perdido: string;
  perdidoSuave: string;
  textoPerdido: string;
  coincidenciaFondo: string;
  avisoFondo: string;
  puntoInactivo: string;
  peligro: string;
  peligroSuave: string;
  sombra: string;
  /** Velo detrás de las hojas modales en pantallas anchas. */
  velo: string;
  mapaTierra: string;
  mapaCalle: string;
  mapaAvenida: string;
  mapaParque: string;
  mapaAgua: string;
  mapaCosta: string;
};

/** Colores de la interfaz. Las dos paletas tienen exactamente las mismas claves. */
export type Paleta = PaletaBase & {
  encontrado: string;
  encontradoSuave: string;
  textoEncontrado: string;
  exito: string;
};

/** Agrega las equivalencias semánticas sin duplicar valores. */
function conEquivalencias(base: PaletaBase): Paleta {
  return {
    ...base,
    encontrado: base.primario,
    encontradoSuave: base.primarioSuave,
    textoEncontrado: base.textoPrimarioSuave,
    exito: base.primario,
  };
}

const claro = conEquivalencias({
  fondo: '#F6F6F2',
  superficie: '#FFFFFF',
  superficieSuave: '#EEEFE8',
  borde: '#E2E3DA',
  bordeCampo: '#8A8D81',
  texto: '#151613',
  textoCuerpo: '#383A33',
  textoSecundario: '#5C5F55',
  primario: '#556B2F',
  primarioPresionado: '#46582A',
  textoSobrePrimario: '#FFFFFF',
  primarioSuave: '#E7EBDA',
  textoPrimarioSuave: '#3E4E1F',
  inverso: '#151613',
  textoInverso: '#FFFFFF',
  perdido: '#C46A1A',
  perdidoSuave: '#F7E6D2',
  textoPerdido: '#8F4A0E',
  coincidenciaFondo: '#EFF2E4',
  avisoFondo: '#F3F4EE',
  puntoInactivo: '#C9CBBF',
  peligro: '#B3261E',
  peligroSuave: '#F9E3E1',
  sombra: 'rgba(21,22,19,0.10)',
  velo: 'rgba(21,22,19,0.40)',
  mapaTierra: '#EFEFE8',
  mapaCalle: '#FFFFFF',
  mapaAvenida: '#FFFFFF',
  mapaParque: '#DCE2C8',
  mapaAgua: '#D5DCDC',
  mapaCosta: '#FFFFFF',
});

const oscuro = conEquivalencias({
  fondo: '#121410',
  superficie: '#1B1D18',
  superficieSuave: '#24271F',
  borde: '#2E3128',
  bordeCampo: '#686C5F',
  texto: '#EDEEE6',
  textoCuerpo: '#CFD2C6',
  textoSecundario: '#A3A797',
  primario: '#8FA357',
  primarioPresionado: '#7D9049',
  textoSobrePrimario: '#121410',
  primarioSuave: '#2C3320',
  textoPrimarioSuave: '#C3D293',
  inverso: '#EDEEE6',
  textoInverso: '#121410',
  perdido: '#F5B068',
  perdidoSuave: '#3A2816',
  textoPerdido: '#F0B77E',
  coincidenciaFondo: '#20261A',
  avisoFondo: '#1B1D18',
  puntoInactivo: '#4A4E42',
  peligro: '#F2B8B5',
  peligroSuave: '#3B1E1C',
  sombra: 'rgba(0,0,0,0.40)',
  velo: 'rgba(0,0,0,0.60)',
  mapaTierra: '#1A1C17',
  mapaCalle: '#272A22',
  mapaAvenida: '#2E3128',
  mapaParque: '#232A19',
  mapaAgua: '#12181A',
  mapaCosta: '#2E3128',
});

export type Esquema = 'claro' | 'oscuro';

export const paletas: Record<Esquema, Paleta> = { claro, oscuro };

/**
 * La historia para compartir (docs/DISENO.md, 6.18): el fondo sale del color
 * dominante de la foto. Si la foto no se puede dibujar (de otro sitio), sale
 * de la especie. En los dos casos se aclara (claro) u oscurece (oscuro) hasta
 * que el texto se lea (src/features/historias/disenio.ts).
 */
export const ColorHistoria: Record<Especie, string> = {
  perro: '#A0703F',
  gato: '#5E7189',
  otro: '#556B2F',
};

// --- Estado de cada caso -----------------------------------------------------

/** Opacidad del marcador de un caso reunido. */
export const OPACIDAD_REUNIDO = 0.45;

/** Perdido o encontrado (animales.tipo_reporte). */
export type { TipoReporte };

export type ColoresEstado = {
  fondo: string;
  texto: string;
  anillo: string;
  /** Opacidad del marcador en el mapa (los reunidos van atenuados). */
  opacidad: number;
};

/** Colores de la etiqueta y del anillo del marcador según el estado del caso. */
export function coloresDeEstado(
  c: Paleta,
  estado: EstadoAnimal,
  tipo: TipoReporte = 'encontrado',
): ColoresEstado {
  if (estado === 'reunido' || estado === 'vinculado') {
    return {
      fondo: c.superficieSuave,
      texto: c.textoSecundario,
      anillo: c.textoSecundario,
      opacidad: estado === 'reunido' ? OPACIDAD_REUNIDO : 1,
    };
  }
  if (tipo === 'perdido' && estado === 'avistado') {
    return { fondo: c.perdidoSuave, texto: c.textoPerdido, anillo: c.perdido, opacidad: 1 };
  }
  return { fondo: c.primarioSuave, texto: c.textoPrimarioSuave, anillo: c.primario, opacidad: 1 };
}

// --- Sombra -----------------------------------------------------------------

/**
 * Solo para lo que flota sobre el mapa o la foto. En oscuro la sombra casi no
 * se ve, así que se suma un borde de 1 px.
 */
export function sombraFlotante(c: Paleta, esquema: Esquema): ViewStyle {
  return {
    boxShadow: `0px 6px 18px ${c.sombra}`,
    ...(esquema === 'oscuro' ? { borderWidth: 1, borderColor: c.borde } : null),
  };
}

// --- Espacios, radios y medidas ------------------------------------------------

export const Espacio = {
  xs: 4,
  s: 8,
  sm: 12,
  m: 16,
  ml: 20,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Margen lateral: 20 en el mapa, 24 en el detalle y los formularios. */
export const Margen = { mapa: 20, pantalla: 24 } as const;

export const Radio = {
  s: 10,
  m: 16,
  l: 20,
  xl: 24,
  hoja: 28,
  cabecera: 36,
  redondo: 999,
} as const;

/** Medidas fijas de componentes (docs/DISENO.md, sección 6). */
export const Medida = {
  areaTactil: 44,
  boton: 54,
  campo: 52,
  chip: 44,
  chipDato: 34,
  botonRedondo: 48,
  barraPestanias: 80,
  rielNavegacion: 88,
} as const;

/** Anchos máximos de columna por pantalla (sección 8.3). */
export const AnchoMaximo = {
  formulario: 560,
  lista: 720,
  acceso: 420,
  detalle: 640,
  detalleAmplio: 1120,
} as const;

// --- Tipografía --------------------------------------------------------------

/** Familias cargadas en src/app/_layout.tsx con useFonts. */
export const FAMILIAS = {
  titulo: 'Fredoka_600SemiBold',
  regular: 'Figtree_400Regular',
  seminegrita: 'Figtree_600SemiBold',
  negrita: 'Figtree_700Bold',
} as const;

const PILA_WEB = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * En Android fontWeight no elige el peso de una fuente cargada: cada peso es
 * una familia. En web se suma una pila del sistema con su peso por si la
 * fuente no llegó a cargar.
 */
function fuente(familia: string, peso: TextStyle['fontWeight']): TextStyle {
  return Platform.OS === 'web'
    ? { fontFamily: `"${familia}", ${PILA_WEB}`, fontWeight: peso }
    : { fontFamily: familia };
}

export const Fuentes = {
  titulo: fuente(FAMILIAS.titulo, '600'),
  regular: fuente(FAMILIAS.regular, '400'),
  seminegrita: fuente(FAMILIAS.seminegrita, '600'),
  negrita: fuente(FAMILIAS.negrita, '700'),
} as const;

/** Escala tipográfica (sección 3). Sin colores: el color lo pone Texto según el esquema. */
export const Tipografia = {
  /** El número grande del muro de reencuentros (6.19). */
  contador: { ...Fuentes.titulo, fontSize: 56, lineHeight: 60 },
  display: { ...Fuentes.titulo, fontSize: 40, lineHeight: 42 },
  titulo: { ...Fuentes.titulo, fontSize: 28, lineHeight: 32 },
  subtitulo: { ...Fuentes.titulo, fontSize: 22, lineHeight: 28 },
  tituloTarjeta: { ...Fuentes.titulo, fontSize: 19, lineHeight: 24 },
  cuerpo: { ...Fuentes.regular, fontSize: 16, lineHeight: 25 },
  cuerpoFuerte: { ...Fuentes.negrita, fontSize: 17, lineHeight: 22 },
  etiquetaCampo: { ...Fuentes.seminegrita, fontSize: 14, lineHeight: 20 },
  secundario: { ...Fuentes.regular, fontSize: 14, lineHeight: 20 },
  pequeno: { ...Fuentes.regular, fontSize: 13, lineHeight: 18 },
  etiqueta: { ...Fuentes.negrita, fontSize: 13, lineHeight: 16 },
  boton: { ...Fuentes.negrita, fontSize: 16, lineHeight: 20 },
  pestania: { ...Fuentes.seminegrita, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type VarianteTexto = keyof typeof Tipografia;

/** Color por defecto de cada variante. */
export const ColorTexto: Record<VarianteTexto, keyof Paleta> = {
  contador: 'texto',
  display: 'texto',
  titulo: 'texto',
  subtitulo: 'texto',
  tituloTarjeta: 'texto',
  cuerpo: 'texto',
  cuerpoFuerte: 'texto',
  etiquetaCampo: 'texto',
  secundario: 'textoSecundario',
  pequeno: 'textoSecundario',
  etiqueta: 'texto',
  boton: 'texto',
  pestania: 'textoSecundario',
};

/** Tope de agrandamiento del texto del sistema en chips, pestañas y etiquetas. */
export const MAX_ESCALA_TEXTO = 1.3;

import type { Especie, EstadoAnimal } from '@/types/dominio';

/** Paleta y escalas de la app. Sin modo oscuro en el MVP. */

export const Colores = {
  primario: '#1E6F5C',
  primarioOscuro: '#155244',
  primarioSuave: '#E3F1EC',
  fondo: '#FFFFFF',
  fondoSuave: '#F4F5F7',
  borde: '#E1E4E8',
  texto: '#1A1D21',
  textoSecundario: '#5F6670',
  textoInvertido: '#FFFFFF',
  peligro: '#C0392B',
  peligroSuave: '#FBE9E7',
  exito: '#2E7D32',
  advertencia: '#B7791F',
} as const;

export const ColorEspecie: Record<Especie, string> = {
  perro: '#D97706',
  gato: '#7C3AED',
  otro: '#2563EB',
};

export const ColorEstado: Record<EstadoAnimal, string> = {
  avistado: '#B7791F',
  resguardado: '#1E6F5C',
  reunido: '#5F6670',
  vinculado: '#5F6670',
};

export const Espacio = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const Radio = {
  s: 8,
  m: 12,
  l: 20,
  redondo: 999,
} as const;

export const Tipografia = {
  titulo: { fontSize: 24, fontWeight: '700' as const, color: Colores.texto },
  subtitulo: { fontSize: 18, fontWeight: '600' as const, color: Colores.texto },
  cuerpo: { fontSize: 16, color: Colores.texto },
  secundario: { fontSize: 14, color: Colores.textoSecundario },
  pequeno: { fontSize: 12, color: Colores.textoSecundario },
} as const;

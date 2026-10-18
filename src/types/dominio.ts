import type { Database } from '@/types/database';

/** Tipos del dominio, derivados de la base para que no se desincronicen. */

export type Especie = Database['public']['Enums']['especie'];
export type Tamanio = Database['public']['Enums']['tamanio'];
export type EstadoAnimal = Database['public']['Enums']['estado_animal'];
export type TipoAvistamiento = Database['public']['Enums']['tipo_avistamiento'];

export type Perfil = Database['public']['Tables']['perfiles']['Row'];
export type AnimalEnMapa = Database['public']['Views']['animales_mapa']['Row'];
export type AvistamientoDetalle = Database['public']['Views']['avistamientos_detalle']['Row'];
export type AnimalDetalle = Database['public']['Views']['animales_detalle']['Row'];
export type CambioEstadoDetalle = Database['public']['Views']['cambios_estado_detalle']['Row'];
export type MotivoDenuncia = Database['public']['Enums']['motivo_denuncia'];

/** [longitud, latitud], el orden que usan GeoJSON y MapLibre. */
export type LngLat = [number, number];

export const ESPECIES: Especie[] = ['perro', 'gato', 'otro'];
export const TAMANIOS: Tamanio[] = ['chico', 'mediano', 'grande'];

export type NuevoReporte = {
  especie: Especie;
  tamanio: Tamanio | null;
  color: string;
  tieneCollar: boolean;
  descripcion: string;
  /** URI local de la foto ya elegida (sin comprimir) y su ancho en píxeles. */
  fotoUri: string;
  fotoAncho: number;
  ubicacion: LngLat;
  vistoEn: Date;
};

export const MOTIVOS_DENUNCIA: MotivoDenuncia[] = [
  'spam',
  'contenido_inapropiado',
  'informacion_falsa',
  'maltrato',
  'otro',
];

export type NuevoAvistamiento = {
  animalId: string;
  fotoUri: string;
  fotoAncho: number;
  ubicacion: LngLat;
  vistoEn: Date;
  nota: string;
};

export type CambioEstado = {
  animalId: string;
  estadoNuevo: Exclude<EstadoAnimal, 'vinculado'>;
  contactoCompartido?: string;
  nota?: string;
  ubicacion?: LngLat | null;
};

/** Un renglón del historial del detalle: avistamiento o cambio de estado. */
export type EventoHistorial =
  | { tipo: 'avistamiento'; fecha: string; avistamiento: AvistamientoDetalle }
  | { tipo: 'cambio_estado'; fecha: string; cambio: CambioEstadoDetalle };

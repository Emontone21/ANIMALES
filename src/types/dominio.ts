import type { Database } from '@/types/database';

/** Tipos del dominio, derivados de la base para que no se desincronicen. */

export type Especie = Database['public']['Enums']['especie'];
export type Tamanio = Database['public']['Enums']['tamanio'];
export type EstadoAnimal = Database['public']['Enums']['estado_animal'];
export type TipoAvistamiento = Database['public']['Enums']['tipo_avistamiento'];

export type Perfil = Database['public']['Tables']['perfiles']['Row'];
export type AnimalEnMapa = Database['public']['Views']['animales_mapa']['Row'];
export type AvistamientoDetalle = Database['public']['Views']['avistamientos_detalle']['Row'];

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

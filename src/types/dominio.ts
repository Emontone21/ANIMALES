import type { Database } from '@/types/database';

/** Tipos del dominio, derivados de la base para que no se desincronicen. */

export type Especie = Database['public']['Enums']['especie'];
export type Tamanio = Database['public']['Enums']['tamanio'];
export type EstadoAnimal = Database['public']['Enums']['estado_animal'];
export type TipoAvistamiento = Database['public']['Enums']['tipo_avistamiento'];
/** perdido: lo publica su familia · encontrado: lo publica quien lo encontró. */
export type TipoReporte = Database['public']['Enums']['tipo_reporte'];

/** Lo que la API deja leer de un perfil: los datos de términos no (ver mis_terminos). */
export type Perfil = Pick<
  Database['public']['Tables']['perfiles']['Row'],
  'id' | 'nombre_publico' | 'avatar_path' | 'es_moderador' | 'created_at' | 'updated_at'
>;
export type AnimalEnMapa = Database['public']['Views']['animales_mapa']['Row'];
export type AvistamientoDetalle = Database['public']['Views']['avistamientos_detalle']['Row'];
export type AnimalDetalle = Database['public']['Views']['animales_detalle']['Row'];
export type CambioEstadoDetalle = Database['public']['Views']['cambios_estado_detalle']['Row'];
export type MotivoDenuncia = Database['public']['Enums']['motivo_denuncia'];
export type CoincidenciaDetalle = Database['public']['Views']['coincidencias_detalle']['Row'];
export type EstadoCoincidencia = Database['public']['Enums']['estado_coincidencia'];
export type Notificacion = Database['public']['Tables']['notificaciones']['Row'];
export type TipoNotificacion = Database['public']['Enums']['tipo_notificacion'];
export type ConversacionDetalle = Database['public']['Views']['conversaciones_detalle']['Row'];
export type MensajeDetalle = Database['public']['Views']['mensajes_detalle']['Row'];
export type DenunciaDetalle = Database['public']['Views']['denuncias_detalle']['Row'];
export type BloqueoDetalle = Database['public']['Views']['bloqueos_detalle']['Row'];
export type EstadoDenuncia = Database['public']['Enums']['estado_denuncia'];

/** Datos que viajan dentro de una notificación (jsonb `datos`). */
export type DatosNotificacion = {
  animal_id?: string;
  coincidencia_id?: string;
  conversacion_id?: string;
};

/** [longitud, latitud], el orden que usan GeoJSON y MapLibre. */
export type LngLat = [number, number];

export const ESPECIES: Especie[] = ['perro', 'gato', 'otro'];
export const TAMANIOS: Tamanio[] = ['chico', 'mediano', 'grande'];

export type NuevoReporte = {
  tipo: TipoReporte;
  especie: Especie;
  /** Solo en perdidos: el nombre y el contacto que la familia decide mostrar. */
  nombre: string;
  contactoFamilia: string;
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

/**
 * Lo que quien publicó puede corregir de su reporte (Fase 8). El tipo, la
 * ubicación y las fotos no se editan. Nombre y contacto, solo en perdidos.
 */
export type CambiosReporte = Pick<
  NuevoReporte,
  'especie' | 'nombre' | 'contactoFamilia' | 'tamanio' | 'color' | 'tieneCollar' | 'descripcion'
>;

/** Lo que hace falta de un caso para armar el texto y la vista previa al compartirlo. */
export type DatosCompartir = {
  tipo: TipoReporte;
  estado: EstadoAnimal;
  nombre: string | null;
  especie: Especie;
  color: string | null;
  tamanio: Tamanio | null;
  tieneCollar: boolean;
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
  /** Foto actual al resguardar (obligatoria en un perdido): URI local y ancho. */
  fotoUri?: string | null;
  fotoAncho?: number;
};

/** Qué pasa con los casos abiertos y lo aportado a casos de otros al borrar la cuenta. */
export type AlBorrarCuenta = 'conservar' | 'borrar';

/** Un renglón del historial del detalle: avistamiento o cambio de estado. */
export type EventoHistorial =
  | { tipo: 'avistamiento'; fecha: string; avistamiento: AvistamientoDetalle }
  | { tipo: 'cambio_estado'; fecha: string; cambio: CambioEstadoDetalle };

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claveSeguimientos } from '@/features/seguimientos/api';
import { borrarFotos, comprimirYSubir } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';
import type {
  AnimalDetalle,
  AnimalEnMapa,
  AvistamientoDetalle,
  CambioEstado,
  CambioEstadoDetalle,
  CambiosReporte,
  EventoHistorial,
  NuevoAvistamiento,
  NuevoReporte,
} from '@/types/dominio';

const LIMITE_MAPA = 500;

export const clavesReportes = {
  mapa: ['animales', 'mapa'] as const,
  animal: (id: string) => ['animales', id] as const,
  avistamientos: (animalId: string) => ['avistamientos', animalId] as const,
  cambiosEstado: (animalId: string) => ['cambios_estado', animalId] as const,
};

// --- Lecturas ---------------------------------------------------------------

/** Animales visibles en el mapa (todos menos los vinculados), los más recientes primero. */
export async function listarAnimalesMapa(): Promise<AnimalEnMapa[]> {
  const { data, error } = await supabase
    .from('animales_mapa')
    .select('*')
    .order('ultimo_avistamiento_en', { ascending: false, nullsFirst: false })
    .limit(LIMITE_MAPA);
  if (error) throw error;
  return data;
}

export async function obtenerAnimal(id: string): Promise<AnimalDetalle | null> {
  const { data, error } = await supabase
    .from('animales_detalle')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Reportes publicados por un usuario, más nuevos primero (incluye cerrados). */
export async function listarMisAnimales(usuarioId: string): Promise<AnimalDetalle[]> {
  const { data, error } = await supabase
    .from('animales_detalle')
    .select('*')
    .eq('creado_por', usuarioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listarAvistamientos(animalId: string): Promise<AvistamientoDetalle[]> {
  const { data, error } = await supabase
    .from('avistamientos_detalle')
    .select('*')
    .eq('animal_id', animalId)
    .order('visto_en', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listarCambiosEstado(animalId: string): Promise<CambioEstadoDetalle[]> {
  const { data, error } = await supabase
    .from('cambios_estado_detalle')
    .select('*')
    .eq('animal_id', animalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Mezcla avistamientos y cambios de estado en una sola línea de tiempo (más nuevo primero). */
export function armarHistorial(
  avistamientos: AvistamientoDetalle[],
  cambios: CambioEstadoDetalle[],
): EventoHistorial[] {
  const eventos: EventoHistorial[] = [
    ...avistamientos.map((av): EventoHistorial => ({
      tipo: 'avistamiento',
      fecha: av.visto_en,
      avistamiento: av,
    })),
    ...cambios.map((c): EventoHistorial => ({
      tipo: 'cambio_estado',
      fecha: c.created_at,
      cambio: c,
    })),
  ];
  return eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

// --- Escrituras -------------------------------------------------------------

/**
 * Comprime la foto, la sube (con su miniatura) y crea animal + primer avistamiento (perdido o
 * encontrado). En los perdidos la base redondea la ubicación. Devuelve el id.
 */
export async function publicarAnimal(reporte: NuevoReporte, usuarioId: string): Promise<string> {
  const fotoPath = await comprimirYSubir(reporte.fotoUri, reporte.fotoAncho, usuarioId);

  const { data, error } = await supabase.rpc('publicar_animal', {
    p_especie: reporte.especie,
    p_foto_path: fotoPath,
    p_lat: reporte.ubicacion[1],
    p_lng: reporte.ubicacion[0],
    p_visto_en: reporte.vistoEn.toISOString(),
    p_tamanio: reporte.tamanio,
    p_color: reporte.color.trim() || null,
    p_tiene_collar: reporte.tieneCollar,
    p_descripcion: reporte.descripcion.trim() || null,
    p_tipo: reporte.tipo,
    p_nombre: reporte.tipo === 'perdido' ? reporte.nombre.trim() || null : null,
    p_contacto_familia: reporte.tipo === 'perdido' ? reporte.contactoFamilia.trim() || null : null,
  });
  if (error) throw error;
  return data;
}

/** "Lo vi acá también": sube la foto y registra un avistamiento sobre un caso abierto. */
export async function registrarAvistamiento(
  nuevo: NuevoAvistamiento,
  usuarioId: string,
): Promise<string> {
  const fotoPath = await comprimirYSubir(nuevo.fotoUri, nuevo.fotoAncho, usuarioId);

  const { data, error } = await supabase.rpc('registrar_avistamiento', {
    p_animal_id: nuevo.animalId,
    p_foto_path: fotoPath,
    p_lat: nuevo.ubicacion[1],
    p_lng: nuevo.ubicacion[0],
    p_visto_en: nuevo.vistoEn.toISOString(),
    p_nota: nuevo.nota.trim() || null,
  });
  if (error) throw error;
  return data;
}

/**
 * Cambia el estado de un caso. Si trae foto (al resguardar; en un perdido es
 * obligatoria), la sube como las demás y entra a la cola de reconocimiento.
 */
export async function cambiarEstado(cambio: CambioEstado, usuarioId: string): Promise<void> {
  let fotoPath: string | null = null;
  if (cambio.fotoUri) {
    fotoPath = await comprimirYSubir(cambio.fotoUri, cambio.fotoAncho, usuarioId);
  }

  const { error } = await supabase.rpc('cambiar_estado_animal', {
    p_animal_id: cambio.animalId,
    p_estado_nuevo: cambio.estadoNuevo,
    p_contacto_compartido: cambio.contactoCompartido?.trim() || null,
    p_nota: cambio.nota?.trim() || null,
    p_lat: cambio.ubicacion?.[1] ?? null,
    p_lng: cambio.ubicacion?.[0] ?? null,
    p_foto_path: fotoPath,
  });
  if (error) throw error;
}

/**
 * Corrige los datos de un reporte propio. En un encontrado no van nombre ni
 * contacto de la familia (la base lo rechaza).
 */
export async function editarReporte(
  animalId: string,
  tipo: AnimalDetalle['tipo_reporte'],
  cambios: CambiosReporte,
): Promise<void> {
  const perdido = tipo === 'perdido';
  const { error } = await supabase.rpc('editar_reporte', {
    p_animal_id: animalId,
    p_especie: cambios.especie,
    p_tamanio: cambios.tamanio,
    p_color: cambios.color.trim() || null,
    p_tiene_collar: cambios.tieneCollar,
    p_descripcion: cambios.descripcion.trim() || null,
    p_nombre: perdido ? cambios.nombre.trim() || null : null,
    p_contacto_familia: perdido ? cambios.contactoFamilia.trim() || null : null,
  });
  if (error) throw error;
}

/**
 * Borra un reporte propio, como al borrar la cuenta: primero las fotos propias
 * del caso (con sus miniaturas) con la API de Storage, después el caso con
 * todo lo que tiene. Si falla una foto, el caso queda entero para reintentar.
 * Las fotos de otras personas quedan en Storage: no son de quien borra.
 */
export async function borrarReporte(animalId: string): Promise<void> {
  const { data: fotos, error: errorFotos } = await supabase.rpc('fotos_del_reporte', {
    p_animal_id: animalId,
  });
  if (errorFotos) throw errorFotos;
  await borrarFotos(fotos);

  const { error } = await supabase.rpc('borrar_reporte', { p_animal_id: animalId });
  if (error) throw error;
}

// --- Hooks -----------------------------------------------------------------

export function useAnimalesMapa() {
  return useQuery({
    queryKey: clavesReportes.mapa,
    queryFn: listarAnimalesMapa,
    staleTime: 30_000,
  });
}

export function useAnimal(id: string | undefined) {
  return useQuery({
    queryKey: clavesReportes.animal(id ?? ''),
    queryFn: () => obtenerAnimal(id as string),
    enabled: Boolean(id),
  });
}

const claveMisAnimales = (usuarioId: string) => ['animales', 'mios', usuarioId] as const;

export function useMisAnimales(usuarioId: string | null | undefined) {
  return useQuery({
    queryKey: claveMisAnimales(usuarioId ?? ''),
    queryFn: () => listarMisAnimales(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
}

export function useAvistamientos(animalId: string | undefined) {
  return useQuery({
    queryKey: clavesReportes.avistamientos(animalId ?? ''),
    queryFn: () => listarAvistamientos(animalId as string),
    enabled: Boolean(animalId),
  });
}

export function useCambiosEstado(animalId: string | undefined) {
  return useQuery({
    queryKey: clavesReportes.cambiosEstado(animalId ?? ''),
    queryFn: () => listarCambiosEstado(animalId as string),
    enabled: Boolean(animalId),
  });
}

/**
 * Invalida todo lo que muestra un animal: mapa, detalle, historial y el botón
 * Seguir (avisar que lo viste o cambiar el estado te hace seguir el caso).
 */
function useInvalidarAnimal() {
  const queryClient = useQueryClient();
  return (animalId: string) => {
    void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.animal(animalId) });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.avistamientos(animalId) });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.cambiosEstado(animalId) });
    void queryClient.invalidateQueries({ queryKey: claveSeguimientos });
  };
}

export function usePublicarAnimal(usuarioId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reporte: NuevoReporte) => {
      if (!usuarioId) throw new Error('Sin sesión');
      return publicarAnimal(reporte, usuarioId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
    },
  });
}

export function useRegistrarAvistamiento(usuarioId: string | null) {
  const invalidar = useInvalidarAnimal();
  return useMutation({
    mutationFn: (nuevo: NuevoAvistamiento) => {
      if (!usuarioId) throw new Error('Sin sesión');
      return registrarAvistamiento(nuevo, usuarioId);
    },
    onSuccess: (_id, nuevo) => invalidar(nuevo.animalId),
  });
}

export function useCambiarEstado(usuarioId: string | null) {
  const invalidar = useInvalidarAnimal();
  return useMutation({
    mutationFn: (cambio: CambioEstado) => {
      if (!usuarioId) throw new Error('Sin sesión');
      return cambiarEstado(cambio, usuarioId);
    },
    onSuccess: (_void, cambio) => invalidar(cambio.animalId),
  });
}

export function useEditarReporte(animal: AnimalDetalle) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: CambiosReporte) => editarReporte(animal.id, animal.tipo_reporte, cambios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
      void queryClient.invalidateQueries({ queryKey: clavesReportes.animal(animal.id) });
      if (animal.creado_por) {
        void queryClient.invalidateQueries({ queryKey: claveMisAnimales(animal.creado_por) });
      }
    },
  });
}

/** Al terminar, el caso deja de existir: se olvida y se refrescan el mapa y Mis reportes. */
export function useBorrarReporte(animal: AnimalDetalle) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => borrarReporte(animal.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: clavesReportes.animal(animal.id) });
      void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
      if (animal.creado_por) {
        void queryClient.invalidateQueries({ queryKey: claveMisAnimales(animal.creado_por) });
      }
    },
  });
}

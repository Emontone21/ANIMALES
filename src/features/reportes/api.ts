import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { comprimirFoto, subirFoto } from '@/lib/imagenes';
import { supabase } from '@/lib/supabase';
import type {
  AnimalDetalle,
  AnimalEnMapa,
  AvistamientoDetalle,
  CambioEstado,
  CambioEstadoDetalle,
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

/** Comprime la foto, la sube y crea animal + primer avistamiento. Devuelve el id. */
export async function publicarAnimal(reporte: NuevoReporte, usuarioId: string): Promise<string> {
  const comprimida = await comprimirFoto(reporte.fotoUri, reporte.fotoAncho);
  const fotoPath = await subirFoto(comprimida.uri, usuarioId);

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
  });
  if (error) throw error;
  return data;
}

/** "Lo vi acá también": sube la foto y registra un avistamiento sobre un caso abierto. */
export async function registrarAvistamiento(
  nuevo: NuevoAvistamiento,
  usuarioId: string,
): Promise<string> {
  const comprimida = await comprimirFoto(nuevo.fotoUri, nuevo.fotoAncho);
  const fotoPath = await subirFoto(comprimida.uri, usuarioId);

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

export async function cambiarEstado(cambio: CambioEstado): Promise<void> {
  const { error } = await supabase.rpc('cambiar_estado_animal', {
    p_animal_id: cambio.animalId,
    p_estado_nuevo: cambio.estadoNuevo,
    p_contacto_compartido: cambio.contactoCompartido?.trim() || null,
    p_nota: cambio.nota?.trim() || null,
    p_lat: cambio.ubicacion?.[1] ?? null,
    p_lng: cambio.ubicacion?.[0] ?? null,
  });
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

export function useMisAnimales(usuarioId: string | null | undefined) {
  return useQuery({
    queryKey: ['animales', 'mios', usuarioId ?? ''],
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

/** Invalida todo lo que muestra un animal: mapa, detalle, historial. */
function useInvalidarAnimal() {
  const queryClient = useQueryClient();
  return (animalId: string) => {
    void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.animal(animalId) });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.avistamientos(animalId) });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.cambiosEstado(animalId) });
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

export function useCambiarEstado() {
  const invalidar = useInvalidarAnimal();
  return useMutation({
    mutationFn: cambiarEstado,
    onSuccess: (_void, cambio) => invalidar(cambio.animalId),
  });
}

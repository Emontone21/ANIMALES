import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { comprimirFoto, subirFoto } from '@/lib/imagenes';
import { supabase } from '@/lib/supabase';
import type { AnimalEnMapa, AvistamientoDetalle, NuevoReporte } from '@/types/dominio';

const LIMITE_MAPA = 500;

export const clavesReportes = {
  mapa: ['animales', 'mapa'] as const,
  animal: (id: string) => ['animales', id] as const,
  avistamientos: (animalId: string) => ['avistamientos', animalId] as const,
};

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

export async function obtenerAnimal(id: string): Promise<AnimalEnMapa | null> {
  const { data, error } = await supabase
    .from('animales_mapa')
    .select('*')
    .eq('id', id)
    .maybeSingle();
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

export function useAvistamientos(animalId: string | undefined) {
  return useQuery({
    queryKey: clavesReportes.avistamientos(animalId ?? ''),
    queryFn: () => listarAvistamientos(animalId as string),
    enabled: Boolean(animalId),
  });
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

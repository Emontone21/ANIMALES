import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { clavesReencuentros } from '@/features/reencuentros/claves';
import { type HistoriaMuro, obtenerHistoria } from '@/features/reencuentros/historia';
import { supabase } from '@/lib/supabase';

/** Cuántas historias trae cada página del muro. */
export const POR_PAGINA = 20;

/** Las historias más recientes; con `antes`, las que volvieron antes de esa fecha. */
export async function listarMuro(antes: string | null): Promise<HistoriaMuro[]> {
  const { data, error } = await supabase.rpc('muro_reencuentros', {
    p_limite: POR_PAGINA,
    p_antes: antes,
  });
  if (error) throw error;
  return data;
}

/** El muro, de a páginas: "Ver más historias" pide las que volvieron antes. */
export function useMuro() {
  return useInfiniteQuery({
    queryKey: clavesReencuentros.muro,
    queryFn: ({ pageParam }) => listarMuro(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) =>
      ultima.length === POR_PAGINA ? (ultima[ultima.length - 1]?.reunido_en ?? null) : null,
    staleTime: 60_000,
  });
}

/** Una historia sola (su link y el bloque "Cómo volvió" del caso). */
export function useHistoria(id: string | undefined) {
  return useQuery({
    queryKey: clavesReencuentros.historia(id ?? ''),
    queryFn: () => obtenerHistoria(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Si ya denunció la historia (no el caso: esa es otra denuncia, la de
 * src/features/denuncias/api.ts). Mandarla es de ModalDenuncia.
 */
export async function yaDenuncioLaHistoria(usuarioId: string, animalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('animal_id', animalId)
    .eq('historia', true)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export function useDenunciaDeHistoria(
  usuarioId: string | null | undefined,
  animalId: string | undefined,
) {
  const consulta = useQuery({
    queryKey: clavesReencuentros.denuncia(usuarioId ?? '', animalId ?? ''),
    queryFn: () => yaDenuncioLaHistoria(usuarioId as string, animalId as string),
    enabled: Boolean(usuarioId && animalId),
  });
  return { yaDenuncio: consulta.data ?? false, refrescar: () => void consulta.refetch() };
}

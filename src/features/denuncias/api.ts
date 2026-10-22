import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Si ya denunció el caso, para el menú del detalle. Mandar una denuncia está en
 * denunciar.ts, que usa solo la hoja (va en un bloque aparte). La denuncia de
 * la historia de un reencuentro es otra (`historia`, 0026): la consulta el muro
 * (src/features/reencuentros/muro.ts).
 */

export const claveDenuncia = (usuarioId: string, animalId: string) =>
  ['denuncias', usuarioId, animalId] as const;

export async function yaDenuncio(usuarioId: string, animalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('animal_id', animalId)
    .eq('historia', false)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export function useDenuncia(usuarioId: string | null | undefined, animalId: string | undefined) {
  const consulta = useQuery({
    queryKey: claveDenuncia(usuarioId ?? '', animalId ?? ''),
    queryFn: () => yaDenuncio(usuarioId as string, animalId as string),
    enabled: Boolean(usuarioId && animalId),
  });
  return { yaDenuncio: consulta.data ?? false, refrescar: () => void consulta.refetch() };
}

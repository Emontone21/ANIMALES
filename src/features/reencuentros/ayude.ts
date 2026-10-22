import { useQuery } from '@tanstack/react-query';

import { clavesReencuentros } from '@/features/reencuentros/claves';
import { supabase } from '@/lib/supabase';

/** "Ayudaste a reunir a N familias": solo lo que una familia agradeció (familias_que_ayude). */
export async function familiasQueAyude(): Promise<number> {
  const { data, error } = await supabase.rpc('familias_que_ayude');
  if (error) throw error;
  return data;
}

export function useFamiliasQueAyude(usuarioId: string | undefined) {
  return useQuery({
    queryKey: clavesReencuentros.ayude(usuarioId ?? ''),
    queryFn: familiasQueAyude,
    enabled: !!usuarioId,
    staleTime: 60_000,
  });
}

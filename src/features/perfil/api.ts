import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/types/dominio';

export async function obtenerPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export function usePerfil(id: string | null | undefined) {
  return useQuery({
    queryKey: ['perfil', id],
    queryFn: () => obtenerPerfil(id as string),
    enabled: Boolean(id),
  });
}

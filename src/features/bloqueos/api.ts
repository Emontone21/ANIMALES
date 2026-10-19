import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clavesMensajes } from '@/features/mensajes/api';
import { supabase } from '@/lib/supabase';
import type { BloqueoDetalle } from '@/types/dominio';

const claveBloqueos = (usuarioId: string) => ['bloqueos', usuarioId] as const;

/** A quiénes bloqueó el usuario, los más recientes primero. Nadie ve los bloqueos de otros. */
export async function listarBloqueados(): Promise<BloqueoDetalle[]> {
  const { data, error } = await supabase
    .from('bloqueos_detalle')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Si ya estaba bloqueado no hace nada (bloqueos no tiene UPDATE). */
export async function bloquear(usuarioId: string, otroId: string): Promise<void> {
  const { error } = await supabase
    .from('bloqueos')
    .upsert(
      { bloqueador_id: usuarioId, bloqueado_id: otroId },
      { onConflict: 'bloqueador_id,bloqueado_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function desbloquear(usuarioId: string, otroId: string): Promise<void> {
  const { error } = await supabase
    .from('bloqueos')
    .delete()
    .eq('bloqueador_id', usuarioId)
    .eq('bloqueado_id', otroId);
  if (error) throw error;
}

export function useBloqueados(usuarioId: string | null | undefined) {
  return useQuery({
    queryKey: claveBloqueos(usuarioId ?? ''),
    queryFn: listarBloqueados,
    enabled: Boolean(usuarioId),
  });
}

/** Bloquear o desbloquear; refresca la lista de Perfil y las conversaciones. */
export function useAlternarBloqueo(usuarioId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ otroId, bloqueado }: { otroId: string; bloqueado: boolean }) => {
      if (!usuarioId) throw new Error('Sin sesión');
      return bloqueado ? desbloquear(usuarioId, otroId) : bloquear(usuarioId, otroId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claveBloqueos(usuarioId ?? '') });
      void queryClient.invalidateQueries({ queryKey: clavesMensajes.conversaciones });
    },
  });
}

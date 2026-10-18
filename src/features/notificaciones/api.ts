import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Notificacion } from '@/types/dominio';

export const clavesNotificaciones = {
  lista: ['notificaciones'] as const,
};

const LIMITE = 100;

export async function listarNotificaciones(): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIMITE);
  if (error) throw error;
  return data;
}

export async function marcarLeida(id: string): Promise<void> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_en: new Date().toISOString() })
    .eq('id', id)
    .is('leida_en', null);
  if (error) throw error;
}

export async function marcarTodasLeidas(usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_en: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .is('leida_en', null);
  if (error) throw error;
}

export async function registrarPushToken(
  usuarioId: string,
  token: string,
  plataforma: 'ios' | 'android' | 'web',
): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, usuario_id: usuarioId, plataforma }, { onConflict: 'token' });
  if (error) throw error;
}

export async function borrarPushToken(token: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error) throw error;
}

// --- Hooks -----------------------------------------------------------------

/** Lista de notificaciones del usuario; se refresca cada 30 s mientras está visible. */
export function useNotificaciones(habilitado: boolean) {
  return useQuery({
    queryKey: clavesNotificaciones.lista,
    queryFn: listarNotificaciones,
    enabled: habilitado,
    refetchInterval: 30_000,
  });
}

export function useMarcarLeida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marcarLeida,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesNotificaciones.lista });
    },
  });
}

export function useMarcarTodasLeidas(usuarioId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!usuarioId) throw new Error('Sin sesión');
      return marcarTodasLeidas(usuarioId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesNotificaciones.lista });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Notificacion } from '@/types/dominio';

export const clavesNotificaciones = {
  lista: ['notificaciones'] as const,
  // Empieza como la lista: al invalidar la lista también se recalcula.
  hayNoLeidas: ['notificaciones', 'hayNoLeidas'] as const,
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

/**
 * Si hay alguna sin leer, para el punto de la pestaña Actividad. Pide una sola
 * fila y solo el id: la lista entera son decenas de KB.
 */
export async function hayNoLeidas(): Promise<boolean> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id')
    .is('leida_en', null)
    .limit(1);
  if (error) throw error;
  return data.length > 0;
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

/**
 * Lista de notificaciones del usuario; se refresca cada 30 s mientras está
 * visible y `activo` (la pantalla en foco: las pestañas siguen montadas).
 */
export function useNotificaciones(habilitado: boolean, activo = true) {
  return useQuery({
    queryKey: clavesNotificaciones.lista,
    queryFn: listarNotificaciones,
    enabled: habilitado,
    refetchInterval: activo ? 30_000 : false,
  });
}

/** El punto de la pestaña Actividad: se refresca cada minuto mientras la app está visible. */
export function useHayNoLeidas(habilitado: boolean) {
  return useQuery({
    queryKey: clavesNotificaciones.hayNoLeidas,
    queryFn: hayNoLeidas,
    enabled: habilitado,
    refetchInterval: 60_000,
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  desdeParaPedir,
  marcarLeidosEnCache,
  sumarMensajes,
} from '@/features/mensajes/incremental';
import { supabase } from '@/lib/supabase';
import type { ConversacionDetalle, MensajeDetalle } from '@/types/dominio';

export const clavesMensajes = {
  conversaciones: ['conversaciones'] as const,
  mensajes: (conversacionId: string) => ['mensajes', conversacionId] as const,
};

export async function listarConversaciones(): Promise<ConversacionDetalle[]> {
  const { data, error } = await supabase
    .from('conversaciones_detalle')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Los mensajes de una conversación; con `desde`, solo los de esa hora en adelante. */
export async function listarMensajes(
  conversacionId: string,
  desde: string | null = null,
): Promise<MensajeDetalle[]> {
  let consulta = supabase
    .from('mensajes_detalle')
    .select('*')
    .eq('conversacion_id', conversacionId);
  if (desde) consulta = consulta.gte('created_at', desde);
  const { data, error } = await consulta.order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function obtenerConversacion(
  conversacionId: string,
): Promise<ConversacionDetalle | null> {
  const { data, error } = await supabase
    .from('conversaciones_detalle')
    .select('*')
    .eq('id', conversacionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Abre (o reutiliza) la conversación con otro usuario sobre un animal. Devuelve el id. */
export async function abrirConversacion(animalId: string, otroUsuarioId: string): Promise<string> {
  const { data, error } = await supabase.rpc('abrir_conversacion', {
    p_animal_id: animalId,
    p_otro_usuario: otroUsuarioId,
  });
  if (error) throw error;
  return data;
}

export async function enviarMensaje(
  conversacionId: string,
  emisorId: string,
  cuerpo: string,
): Promise<void> {
  const { error } = await supabase
    .from('mensajes')
    .insert({ conversacion_id: conversacionId, emisor_id: emisorId, cuerpo: cuerpo.trim() });
  if (error) throw error;
}

/** Marca como leídos los mensajes ajenos de una conversación. */
export async function marcarLeidos(conversacionId: string, miId: string): Promise<void> {
  const { error } = await supabase
    .from('mensajes')
    .update({ leido_en: new Date().toISOString() })
    .eq('conversacion_id', conversacionId)
    .neq('emisor_id', miId)
    .is('leido_en', null);
  if (error) throw error;
}

// --- Hooks -----------------------------------------------------------------

/** Se refresca cada 20 s solo mientras `activo` (la pantalla en foco). */
export function useConversaciones(habilitado: boolean, activo = true) {
  return useQuery({
    queryKey: clavesMensajes.conversaciones,
    queryFn: listarConversaciones,
    enabled: habilitado,
    refetchInterval: activo ? 20_000 : false,
  });
}

export function useConversacion(conversacionId: string | undefined) {
  return useQuery({
    queryKey: [...clavesMensajes.conversaciones, conversacionId ?? ''],
    queryFn: () => obtenerConversacion(conversacionId as string),
    enabled: Boolean(conversacionId),
  });
}

/**
 * Sin WebSockets: la conversación abierta se refresca cada 4 s, solo mientras
 * `activo` (si otra pantalla la tapa, por ejemplo el caso, deja de pedir). La
 * primera vez pide todo; después, solo lo nuevo (M20, ver incremental.ts).
 */
export function useMensajes(conversacionId: string | undefined, activo = true) {
  const queryClient = useQueryClient();
  const clave = clavesMensajes.mensajes(conversacionId ?? '');
  return useQuery({
    queryKey: clave,
    queryFn: async () => {
      const previos = queryClient.getQueryData<MensajeDetalle[]>(clave);
      const nuevos = await listarMensajes(conversacionId as string, desdeParaPedir(previos));
      return previos ? sumarMensajes(previos, nuevos) : nuevos;
    },
    enabled: Boolean(conversacionId),
    refetchInterval: activo ? 4_000 : false,
  });
}

/**
 * Después de marcarLeidos, los mismos mensajes en la caché: como ya no se
 * vuelven a pedir, si no, seguirían figurando sin leer.
 */
export function anotarLeidos(
  queryClient: ReturnType<typeof useQueryClient>,
  conversacionId: string,
  miId: string,
) {
  queryClient.setQueryData<MensajeDetalle[]>(clavesMensajes.mensajes(conversacionId), (previos) =>
    previos ? marcarLeidosEnCache(previos, miId, new Date().toISOString()) : previos,
  );
}

export function useEnviarMensaje(conversacionId: string, emisorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: string) => enviarMensaje(conversacionId, emisorId, cuerpo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesMensajes.mensajes(conversacionId) });
      void queryClient.invalidateQueries({ queryKey: clavesMensajes.conversaciones });
    },
  });
}

export function useAbrirConversacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ animalId, otroUsuarioId }: { animalId: string; otroUsuarioId: string }) =>
      abrirConversacion(animalId, otroUsuarioId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesMensajes.conversaciones });
    },
  });
}

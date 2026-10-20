import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type ResultadoProcesar, resultadoProcesar } from '@/features/reconocimiento/estado';
import { supabase } from '@/lib/supabase';
import type { EstadoReconocimiento } from '@/types/dominio';

/**
 * Moderación › Reconocimiento: el estado del servicio de visión y "Procesar
 * pendientes ahora". Solo moderación (lo controla la base). Nunca trae la URL
 * ni el secreto del servicio.
 */

export const clavesReconocimiento = {
  estado: ['moderacion', 'reconocimiento'] as const,
};

export async function obtenerEstadoReconocimiento(): Promise<EstadoReconocimiento> {
  const { data, error } = await supabase.rpc('estado_reconocimiento');
  if (error) throw error;
  const fila = data[0];
  if (!fila) throw new Error('estado_reconocimiento no devolvió filas');
  return fila;
}

export async function procesarPendientes(): Promise<ResultadoProcesar> {
  const { data, error } = await supabase.rpc('procesar_pendientes_vision');
  if (error) throw error;
  return resultadoProcesar(data);
}

/** Se refresca cada 15 s mientras `activo` (la sección a la vista): se ve bajar la cola. */
export function useEstadoReconocimiento(activo: boolean) {
  return useQuery({
    queryKey: clavesReconocimiento.estado,
    queryFn: obtenerEstadoReconocimiento,
    refetchInterval: activo ? 15_000 : false,
  });
}

export function useProcesarPendientes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: procesarPendientes,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: clavesReconocimiento.estado }),
  });
}

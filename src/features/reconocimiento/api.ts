import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type ResultadoProcesar, resultadoProcesar } from '@/features/reconocimiento/estado';
import { supabase } from '@/lib/supabase';
import type { EstadoReconocimiento, LlamadaIa } from '@/types/dominio';

/**
 * Moderación › Reconocimiento: el estado del reconocimiento con IA, las
 * llamadas que fallaron, "Procesar pendientes ahora" y "Reactivar". Solo
 * moderación (lo controla la base). Nunca trae la URL ni el secreto.
 */

export const clavesReconocimiento = {
  estado: ['moderacion', 'reconocimiento'] as const,
  errores: ['moderacion', 'reconocimiento', 'errores'] as const,
};

/** Cuántas llamadas fallidas se muestran, de la última semana. */
const ERRORES_A_MOSTRAR = 5;
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export async function obtenerEstadoReconocimiento(): Promise<EstadoReconocimiento> {
  const { data, error } = await supabase.rpc('estado_reconocimiento');
  if (error) throw error;
  const fila = data[0];
  if (!fila) throw new Error('estado_reconocimiento no devolvió filas');
  return fila;
}

export type ErrorIa = Pick<LlamadaIa, 'id' | 'created_at' | 'tipo' | 'resultado'>;

/** Las últimas llamadas a la API que no anduvieron (llamadas_ia: solo la leen moderadores). */
export async function listarErroresIa(ahora: Date = new Date()): Promise<ErrorIa[]> {
  const { data, error } = await supabase
    .from('llamadas_ia')
    .select('id, created_at, tipo, resultado')
    .not('resultado', 'in', '(ok,en_curso)')
    .gte('created_at', new Date(ahora.getTime() - SEMANA_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(ERRORES_A_MOSTRAR);
  if (error) throw error;
  return data;
}

export async function procesarPendientes(): Promise<ResultadoProcesar> {
  const { data, error } = await supabase.rpc('procesar_pendientes_vision');
  if (error) throw error;
  return resultadoProcesar(data);
}

export async function reactivarReconocimiento(): Promise<ResultadoProcesar> {
  const { data, error } = await supabase.rpc('reactivar_reconocimiento');
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

export function useErroresIa(activo: boolean) {
  return useQuery({
    queryKey: clavesReconocimiento.errores,
    queryFn: () => listarErroresIa(),
    refetchInterval: activo ? 15_000 : false,
  });
}

function useRefrescarAlTerminar(accion: () => Promise<ResultadoProcesar>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesReconocimiento.estado });
      void queryClient.invalidateQueries({ queryKey: clavesReconocimiento.errores });
    },
  });
}

export function useProcesarPendientes() {
  return useRefrescarAlTerminar(procesarPendientes);
}

export function useReactivarReconocimiento() {
  return useRefrescarAlTerminar(reactivarReconocimiento);
}

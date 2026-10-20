import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clavesNotificaciones } from '@/features/notificaciones/api';
import { urlCaptura } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';
import type { ReporteErrorDetalle } from '@/types/dominio';

/**
 * Panel de moderación › Errores: listar los reportes de errores, resolverlos y
 * ver sus capturas. Solo lo usa esa sección, que se carga al elegirla. Mandar
 * un reporte está en api.ts.
 */

export const clavesErrores = {
  lista: ['moderacion', 'errores'] as const,
  captura: (ruta: string) => ['moderacion', 'errores', 'captura', ruta] as const,
};

/** Todos los reportes, del más nuevo al más viejo (la RLS solo se los da a moderación). */
export async function listarReportesErrores(): Promise<ReporteErrorDetalle[]> {
  const { data, error } = await supabase
    .from('reportes_errores_detalle')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function resolverReporteError(id: string, nota: string): Promise<void> {
  const { error } = await supabase.rpc('resolver_reporte_error', {
    p_id: id,
    p_nota: nota.trim() || null,
  });
  if (error) throw error;
}

export function useReportesErrores(habilitado: boolean) {
  return useQuery({
    queryKey: clavesErrores.lista,
    queryFn: listarReportesErrores,
    enabled: habilitado,
  });
}

export function useResolverReporteError() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: string }) => resolverReporteError(id, nota),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesErrores.lista });
      void queryClient.invalidateQueries({ queryKey: clavesNotificaciones.lista });
    },
  });
}

/** La URL firmada de una captura, pedida al abrir el detalle del reporte. */
export function useUrlCaptura(ruta: string | null) {
  return useQuery({
    queryKey: clavesErrores.captura(ruta ?? ''),
    queryFn: () => urlCaptura(ruta as string),
    enabled: ruta !== null,
    // El link dura una hora: se pide de nuevo antes de que venza.
    staleTime: 50 * 60 * 1000,
  });
}

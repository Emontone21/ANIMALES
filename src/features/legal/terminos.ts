import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Versión de los textos de src/i18n/es-UY.ts (t.legal). Tiene que coincidir con
 * config_app.terminos_version: al cambiar los textos, subí las dos, y todos los
 * usuarios los vuelven a aceptar antes de publicar, escribir o denunciar.
 */
export const VERSION_TERMINOS = '2026-10-21';

export type EstadoTerminos = {
  version: string | null;
  aceptadosEn: string | null;
  vigente: string | null;
};

const clave = (usuarioId: string) => ['terminos', usuarioId] as const;

export async function obtenerTerminos(): Promise<EstadoTerminos> {
  const { data, error } = await supabase.rpc('mis_terminos');
  if (error) throw error;
  const fila = data[0];
  return {
    version: fila?.version ?? null,
    aceptadosEn: fila?.aceptados_en ?? null,
    vigente: fila?.vigente ?? null,
  };
}

export async function aceptarTerminos(): Promise<void> {
  const { error } = await supabase.rpc('aceptar_terminos', { p_version: VERSION_TERMINOS });
  if (error) throw error;
}

/**
 * Si el usuario aceptó la versión vigente. La base es la que decide: publicar,
 * avisar, cambiar estados, escribir y denunciar fallan sin esto.
 */
export function useTerminos(usuarioId: string | null | undefined) {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: clave(usuarioId ?? ''),
    queryFn: obtenerTerminos,
    enabled: Boolean(usuarioId),
    staleTime: 5 * 60_000,
  });

  const aceptar = useMutation({
    mutationFn: aceptarTerminos,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clave(usuarioId ?? '') });
    },
  });

  const datos = consulta.data;
  return {
    cargando: consulta.isPending && Boolean(usuarioId),
    /** true si aceptó la versión vigente. Mientras carga o sin cuenta, false. */
    aceptados: Boolean(datos?.version && datos.version === datos.vigente),
    /** Aceptó una versión anterior: los textos cambiaron desde entonces. */
    cambiaron: Boolean(datos?.version && datos.version !== datos.vigente),
    error: consulta.error,
    reintentar: () => void consulta.refetch(),
    aceptar,
  };
}

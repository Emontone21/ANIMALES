import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clavesReportes } from '@/features/reportes/api';
import { supabase } from '@/lib/supabase';
import type { CoincidenciaDetalle } from '@/types/dominio';

const clave = (animalId: string) => ['coincidencias', animalId] as const;

/** Coincidencias en las que participa un animal, pendientes primero y más parecidas primero. */
export async function listarCoincidencias(animalId: string): Promise<CoincidenciaDetalle[]> {
  const { data, error } = await supabase
    .from('coincidencias_detalle')
    .select('*')
    .or(`animal_origen.eq.${animalId},animal_candidato.eq.${animalId}`)
    .order('similitud', { ascending: false });
  if (error) throw error;
  const orden = { pendiente: 0, confirmada: 1, rechazada: 2 } as const;
  return [...data].sort((a, b) => orden[a.estado] - orden[b.estado]);
}

/** Confirma o rechaza. Al confirmar devuelve el id del caso principal. */
export async function resolverCoincidencia(
  id: string,
  confirmada: boolean,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolver_coincidencia', {
    p_id: id,
    p_confirmada: confirmada,
  });
  if (error) throw error;
  return data;
}

/** El reconocimiento tarda; mientras la pantalla está abierta se refresca cada 30 s. */
export function useCoincidencias(animalId: string | undefined) {
  return useQuery({
    queryKey: clave(animalId ?? ''),
    queryFn: () => listarCoincidencias(animalId as string),
    enabled: Boolean(animalId),
    refetchInterval: 30_000,
  });
}

export function useResolverCoincidencia(animalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmada }: { id: string; confirmada: boolean }) =>
      resolverCoincidencia(id, confirmada),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coincidencias'] });
      void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
      void queryClient.invalidateQueries({ queryKey: clavesReportes.animal(animalId) });
      void queryClient.invalidateQueries({ queryKey: clavesReportes.avistamientos(animalId) });
    },
  });
}

/** Qué animal es "el otro" en una coincidencia, visto desde animalId. */
export function otroAnimal(c: CoincidenciaDetalle, animalId: string) {
  const esOrigen = c.animal_origen === animalId;
  return {
    id: esOrigen ? c.animal_candidato : c.animal_origen,
    fotoPath: esOrigen ? c.candidato_foto_path : c.origen_foto_path,
    especie: esOrigen ? c.candidato_especie : c.origen_especie,
    estado: esOrigen ? c.candidato_estado : c.origen_estado,
    descripcion: esOrigen ? c.candidato_descripcion : c.origen_descripcion,
    tipo: esOrigen ? c.candidato_tipo_reporte : c.origen_tipo_reporte,
    nombre: esOrigen ? c.candidato_nombre : c.origen_nombre,
  };
}

/** Si el par incluye un perdido (nunca hay dos), quién es su familia. */
export function familiaDelPerdido(c: CoincidenciaDetalle): string | null {
  if (c.origen_tipo_reporte === 'perdido') return c.origen_creado_por;
  if (c.candidato_tipo_reporte === 'perdido') return c.candidato_creado_por;
  return null;
}

/**
 * Las mismas reglas que resolver_coincidencia: con un perdido decide solo su
 * familia; entre dos encontrados, quien publicó cualquiera de los dos o un moderador.
 */
export function puedeResolver(
  c: CoincidenciaDetalle,
  usuarioId: string | null | undefined,
  esModerador: boolean,
): boolean {
  if (!usuarioId) return false;
  const familia = familiaDelPerdido(c);
  if (familia) return usuarioId === familia;
  return usuarioId === c.origen_creado_por || usuarioId === c.candidato_creado_por || esModerador;
}

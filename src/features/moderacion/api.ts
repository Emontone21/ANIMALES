import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clavesReportes } from '@/features/reportes/api';
import { supabase } from '@/lib/supabase';
import type { DenunciaDetalle, EstadoDenuncia } from '@/types/dominio';

const clave = ['moderacion', 'denuncias'] as const;

/** Todas las denuncias (RLS solo las devuelve completas a moderadores). */
export async function listarDenuncias(): Promise<DenunciaDetalle[]> {
  const { data, error } = await supabase
    .from('denuncias_detalle')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function resolverDenuncia(id: string, estado: EstadoDenuncia): Promise<void> {
  const { error } = await supabase.from('denuncias').update({ estado }).eq('id', id);
  if (error) throw error;
}

/** Oculta o muestra una publicación. La RPC valida que quien llama sea moderador. */
export async function ocultarAnimal(animalId: string, oculto: boolean): Promise<void> {
  const { error } = await supabase.rpc('moderar_animal', {
    p_animal_id: animalId,
    p_oculto: oculto,
  });
  if (error) throw error;
}

export function useDenuncias(habilitado: boolean) {
  return useQuery({ queryKey: clave, queryFn: listarDenuncias, enabled: habilitado });
}

export function useAccionesModeracion() {
  const queryClient = useQueryClient();
  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: clave });
    void queryClient.invalidateQueries({ queryKey: clavesReportes.mapa });
  };
  const resolver = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoDenuncia }) =>
      resolverDenuncia(id, estado),
    onSuccess: invalidar,
  });
  const ocultar = useMutation({
    mutationFn: ({ animalId, oculto }: { animalId: string; oculto: boolean }) =>
      ocultarAnimal(animalId, oculto),
    onSuccess: invalidar,
  });
  return { resolver, ocultar };
}

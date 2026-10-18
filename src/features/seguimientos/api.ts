import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const clave = (usuarioId: string, animalId: string) =>
  ['seguimientos', usuarioId, animalId] as const;

export async function sigueAnimal(usuarioId: string, animalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('seguimientos')
    .select('animal_id')
    .eq('usuario_id', usuarioId)
    .eq('animal_id', animalId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function seguirAnimal(usuarioId: string, animalId: string): Promise<void> {
  const { error } = await supabase
    .from('seguimientos')
    .upsert({ usuario_id: usuarioId, animal_id: animalId }, { onConflict: 'usuario_id,animal_id' });
  if (error) throw error;
}

export async function dejarDeSeguir(usuarioId: string, animalId: string): Promise<void> {
  const { error } = await supabase
    .from('seguimientos')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('animal_id', animalId);
  if (error) throw error;
}

/** Estado "sigo este caso" y acción para alternarlo. */
export function useSeguimiento(usuarioId: string | null | undefined, animalId: string | undefined) {
  const queryClient = useQueryClient();
  const habilitado = Boolean(usuarioId && animalId);

  const consulta = useQuery({
    queryKey: clave(usuarioId ?? '', animalId ?? ''),
    queryFn: () => sigueAnimal(usuarioId as string, animalId as string),
    enabled: habilitado,
  });

  const alternar = useMutation({
    mutationFn: async () => {
      if (!usuarioId || !animalId) throw new Error('Sin sesión');
      if (consulta.data) {
        await dejarDeSeguir(usuarioId, animalId);
      } else {
        await seguirAnimal(usuarioId, animalId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clave(usuarioId ?? '', animalId ?? '') });
    },
  });

  return { sigue: consulta.data ?? false, cargando: consulta.isPending && habilitado, alternar };
}

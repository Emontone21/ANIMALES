import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { MotivoDenuncia } from '@/types/dominio';

const clave = (usuarioId: string, animalId: string) => ['denuncias', usuarioId, animalId] as const;

export type NuevaDenuncia = {
  animalId: string;
  avistamientoId?: string | null;
  motivo: MotivoDenuncia;
  detalle: string;
};

export async function yaDenuncio(usuarioId: string, animalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('animal_id', animalId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function denunciar(usuarioId: string, nueva: NuevaDenuncia): Promise<void> {
  const { error } = await supabase.from('denuncias').insert({
    usuario_id: usuarioId,
    animal_id: nueva.animalId,
    avistamiento_id: nueva.avistamientoId ?? null,
    motivo: nueva.motivo,
    detalle: nueva.detalle.trim() || null,
  });
  if (error) throw error;
}

export function useDenuncia(usuarioId: string | null | undefined, animalId: string | undefined) {
  const queryClient = useQueryClient();
  const habilitado = Boolean(usuarioId && animalId);

  const consulta = useQuery({
    queryKey: clave(usuarioId ?? '', animalId ?? ''),
    queryFn: () => yaDenuncio(usuarioId as string, animalId as string),
    enabled: habilitado,
  });

  const enviar = useMutation({
    mutationFn: (nueva: NuevaDenuncia) => {
      if (!usuarioId) throw new Error('Sin sesión');
      return denunciar(usuarioId, nueva);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clave(usuarioId ?? '', animalId ?? '') });
    },
  });

  return { yaDenuncio: consulta.data ?? false, enviar };
}

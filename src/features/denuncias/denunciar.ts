import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { MotivoDenuncia } from '@/types/dominio';

/**
 * Mandar una denuncia. Solo lo usa ModalDenuncia, que va en un bloque aparte
 * (lo cargan el detalle del caso y el muro): quien la abrió actualiza su
 * "ya denunciaste" en `onExito`.
 */

export type NuevaDenuncia = {
  animalId: string;
  avistamientoId?: string | null;
  motivo: MotivoDenuncia;
  detalle: string;
  /** La historia del reencuentro del caso, no el caso (0026). */
  historia: boolean;
};

export async function denunciar(usuarioId: string, nueva: NuevaDenuncia): Promise<void> {
  const { error } = await supabase.from('denuncias').insert({
    usuario_id: usuarioId,
    animal_id: nueva.animalId,
    avistamiento_id: nueva.avistamientoId ?? null,
    motivo: nueva.motivo,
    detalle: nueva.detalle.trim() || null,
    historia: nueva.historia,
  });
  if (error) throw error;
}

export function useDenunciar(usuarioId: string) {
  return useMutation({ mutationFn: (nueva: NuevaDenuncia) => denunciar(usuarioId, nueva) });
}

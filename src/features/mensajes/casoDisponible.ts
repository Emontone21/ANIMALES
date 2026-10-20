import type { ConversacionDetalle } from '@/types/dominio';

/**
 * Si quien mira la conversación puede ver su caso (0014: un caso oculto lo ven
 * solo quien lo publicó y moderación). Sin la 0014 aplicada, la vista no trae
 * la columna y ningún caso está oculto para nadie: se ve.
 */
export function casoDisponible(conversacion: Pick<ConversacionDetalle, 'animal_disponible'>) {
  return conversacion.animal_disponible !== false;
}

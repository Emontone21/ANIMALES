import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/** Una historia del muro: lo público y nada más (muro_reencuentros). */
export type HistoriaMuro = Database['public']['Functions']['muro_reencuentros']['Returns'][number];

/** Una historia sola (su link): lo mismo, más si está oculta (la ve así solo la familia o moderación). */
export type HistoriaPublica =
  Database['public']['Functions']['historia_reencuentro']['Returns'][number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La historia de un caso, o null si no hay (o no está disponible para quien
 * mira). Un id que no es un uuid no consulta la base. La usan la precarga del
 * link (/reencuentros/<id>) y el muro: es lo único del muro en la carga inicial.
 */
export async function obtenerHistoria(id: string): Promise<HistoriaPublica | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabase.rpc('historia_reencuentro', { p_animal_id: id });
  if (error) throw error;
  return data[0] ?? null;
}

import { useQuery } from '@tanstack/react-query';

import { clavesReencuentros } from '@/features/reencuentros/claves';
import { supabase } from '@/lib/supabase';

/**
 * El contador de reencuentros. Solo lo importa
 * src/components/reencuentros/Contador.tsx, que cargan con lazy la tarjeta de
 * "Cerca tuyo" y el muro: si lo importaran los dos, Metro lo pondría en __common.
 */

/** Con menos reencuentros, no se muestra el número: "Los primeros reencuentros de Spot". */
export const MINIMO_PARA_EL_NUMERO = 5;

/** El número del contador, o null mientras haya menos de MINIMO_PARA_EL_NUMERO. */
export function numeroVisible(n: number | null | undefined): number | null {
  return typeof n === 'number' && n >= MINIMO_PARA_EL_NUMERO ? n : null;
}

/** Todos los casos reunidos, sin ocultos ni datos de demo (contador_reencuentros). */
export async function contarReencuentros(): Promise<number> {
  const { data, error } = await supabase.rpc('contador_reencuentros');
  if (error) throw error;
  return data;
}

/** Cambia poco: se da por fresco 5 minutos. */
export function useContadorReencuentros() {
  return useQuery({
    queryKey: clavesReencuentros.contador,
    queryFn: contarReencuentros,
    staleTime: 5 * 60_000,
  });
}

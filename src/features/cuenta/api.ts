import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { borrarFotos } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';
import type { AlBorrarCuenta } from '@/types/dominio';

export { ErrorFotos } from '@/lib/fotos';

export type PasoBorrado = 'fotos' | 'cuenta';

/**
 * Borra la cuenta del usuario actual:
 *   1. pide a la base qué fotos de su carpeta se borran (todas menos las de lo
 *      que queda publicado sin autor) y las borra con la API de Storage, con su
 *      sesión: la política deja borrar lo propio y por SQL no se puede;
 *   2. llama a borrar_mi_cuenta, que borra o deja sin autor lo demás y borra
 *      el usuario de Auth (solo el de auth.uid()).
 * Si falla una foto se corta antes de borrar la cuenta, para poder reintentar.
 * La sesión la cierra useBorrarCuenta al terminar.
 */
export async function borrarCuenta(
  alBorrar: AlBorrarCuenta,
  onPaso?: (paso: PasoBorrado) => void,
): Promise<void> {
  const conservar = alBorrar === 'conservar';

  onPaso?.('fotos');
  const { data: fotos, error: errorLista } = await supabase.rpc('fotos_para_borrar', {
    p_conservar_abiertos: conservar,
  });
  if (errorLista) throw errorLista;
  // Las miniaturas vienen en la lista: están en la carpeta del usuario.
  await borrarFotos(fotos);

  onPaso?.('cuenta');
  const { error } = await supabase.rpc('borrar_mi_cuenta', { p_conservar_abiertos: conservar });
  if (error) throw error;
}

/**
 * Al terminar vuelve al mapa y cierra la sesión. Va acá y no en la pantalla:
 * al cerrarse la sesión, la pantalla de borrar se desmonta.
 */
export function useBorrarCuenta(onPaso?: (paso: PasoBorrado) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alBorrar: AlBorrarCuenta) => borrarCuenta(alBorrar, onPaso),
    onSuccess: async () => {
      router.replace('/');
      // Nada de lo que estaba en memoria es de alguien que siga existiendo.
      queryClient.clear();
      // El usuario ya no existe: alcanza con olvidar la sesión en este dispositivo.
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}

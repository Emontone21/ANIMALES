import { Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { leerParametros, tieneErrorAuth } from '@/lib/urlAuth';

type EstadoRecuperacion = {
  /** Se entró con un link de recuperación: falta elegir la contraseña nueva. */
  activa: boolean;
  /** El link de recuperación vino con error (vencido o ya usado). */
  linkInvalido: boolean;
};

export const useRecuperacion = create<EstadoRecuperacion>(() => ({
  activa: false,
  linkInvalido: false,
}));

export function marcarRecuperacion(): void {
  useRecuperacion.setState({ activa: true, linkInvalido: false });
}

export function terminarRecuperacion(): void {
  useRecuperacion.setState({ activa: false, linkInvalido: false });
}

// En web, Supabase lee el link al crear el cliente y avisa con PASSWORD_RECOVERY
// apenas termina, antes de que la app termine de montar. Por eso la
// suscripción va acá, al cargar el módulo, y no en un efecto de React.
supabase.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') marcarRecuperacion();
  if (evento === 'SIGNED_OUT') terminarRecuperacion();
});

// La URL se lee también acá, antes de que el cliente la limpie: así la pantalla
// sabe enseguida que es una recuperación y, si el link venció (Supabase no
// manda ningún evento en ese caso), lo puede decir.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const params = leerParametros(window.location.href);
  if (params['type'] === 'recovery' && params['access_token']) {
    marcarRecuperacion();
  } else if (
    window.location.pathname.startsWith('/auth/nueva-contrasena') &&
    tieneErrorAuth(params)
  ) {
    useRecuperacion.setState({ linkInvalido: true });
  }
}

import { Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { linkDeRecuperacionInvalido } from '@/lib/urlAuth';

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

// Supabase canjea el código del link (?code=…) al crear el cliente y avisa con
// PASSWORD_RECOVERY apenas termina, a veces antes de que la app termine de
// montar. Por eso la suscripción va acá, al cargar el módulo, y no en un
// efecto de React. Es la única forma de empezar una recuperación: con PKCE,
// un link con tokens en el fragmento (#type=recovery&access_token=…) no abre
// sesión y no tiene que llevar a elegir una contraseña (auditoría 2, S-M1).
supabase.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') marcarRecuperacion();
  if (evento === 'SIGNED_OUT') terminarRecuperacion();
});

// Si el link venció, Supabase vuelve con el error en la URL y no manda ningún
// evento: la pantalla lo lee acá, antes de que el cliente limpie la URL.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  if (linkDeRecuperacionInvalido(window.location.href)) {
    useRecuperacion.setState({ linkInvalido: true });
  }
}

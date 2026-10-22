import { Platform } from 'react-native';
import { create } from 'zustand';

import { type ClienteDeUnUso, supabase } from '@/lib/supabase';
import { enmascararEmail, linkDeRecuperacionInvalido } from '@/lib/urlAuth';

type EstadoRecuperacion = {
  /** Se entró con un link de recuperación: falta elegir la contraseña nueva. */
  activa: boolean;
  /** El link de recuperación vino con error (vencido o ya usado). */
  linkInvalido: boolean;
  /** De qué cuenta es, enmascarado (e***@gmail.com): la persona tiene que reconocerla. */
  cuenta: string | null;
};

export const useRecuperacion = create<EstadoRecuperacion>(() => ({
  activa: false,
  linkInvalido: false,
  cuenta: null,
}));

/**
 * La sesión que abrió el link del mail (/auth/confirmar), en un cliente que la
 * tiene solo en memoria. Pasa a la app recién cuando la persona elige la
 * contraseña nueva (cambiarContrasena); si toca "No es mi cuenta", se cierra.
 * Así el link de otra cuenta no deja a nadie adentro sin darse cuenta.
 */
let clienteDelLink: ClienteDeUnUso | null = null;

export function clienteDeRecuperacion(): ClienteDeUnUso | null {
  return clienteDelLink;
}

/** Recuperación con la sesión de la app (el link viejo, con ?code=, en este navegador). */
export function marcarRecuperacion(email?: string | null): void {
  useRecuperacion.setState({ activa: true, linkInvalido: false, cuenta: enmascararEmail(email) });
}

/** Recuperación con el link del mail, que se pudo abrir en cualquier navegador. */
export function empezarRecuperacionConLink(cliente: ClienteDeUnUso, email?: string | null): void {
  clienteDelLink = cliente;
  marcarRecuperacion(email);
}

export function terminarRecuperacion(): void {
  clienteDelLink = null;
  useRecuperacion.setState({ activa: false, linkInvalido: false, cuenta: null });
}

/**
 * "No es mi cuenta": cierra la sesión del link (solo esa: `local` no toca las
 * otras sesiones de la cuenta) y la contraseña queda como estaba.
 */
export async function cancelarRecuperacion(): Promise<void> {
  const cliente = clienteDelLink;
  terminarRecuperacion();
  await (cliente ?? supabase).auth.signOut({ scope: 'local' });
}

// Con el link viejo (?code=), Supabase canjea el código al crear el cliente y
// avisa con PASSWORD_RECOVERY apenas termina, a veces antes de que la app
// termine de montar. Por eso la suscripción va acá, al cargar el módulo, y no
// en un efecto de React. Con PKCE, un link con tokens en el fragmento
// (#type=recovery&access_token=…) no abre sesión y no lleva a elegir una
// contraseña (auditoría 2, S-M1).
supabase.auth.onAuthStateChange((evento, sesion) => {
  if (evento === 'PASSWORD_RECOVERY') marcarRecuperacion(sesion?.user.email);
  // Si la recuperación es con el link del mail, la sesión de la app es otra.
  if (evento === 'SIGNED_OUT' && !clienteDelLink) terminarRecuperacion();
});

// Si el link venció, Supabase vuelve con el error en la URL y no manda ningún
// evento: la pantalla lo lee acá, antes de que el cliente limpie la URL.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  if (linkDeRecuperacionInvalido(window.location.href)) {
    useRecuperacion.setState({ linkInvalido: true });
  }
}

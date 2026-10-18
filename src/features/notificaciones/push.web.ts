import type { Href } from 'expo-router';

import type { DatosNotificacion } from '@/types/dominio';

/** En web no hay push: las novedades se ven en la pestaña Actividad. */
export function usePush(_usuarioId: string | null | undefined): void {}

export function destinoDe(datos: DatosNotificacion): Href {
  if (datos.conversacion_id) {
    return { pathname: '/conversacion/[id]', params: { id: datos.conversacion_id } };
  }
  if (datos.animal_id) return { pathname: '/animal/[id]', params: { id: datos.animal_id } };
  return '/actividad';
}

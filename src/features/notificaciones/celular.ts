import type { AppConNavegador } from '@/features/instalar/formaDeInstalar';
import type { ComoDesbloquear, EstadoAvisos } from '@/features/notificaciones/formaDeAvisar';

export { ofrecerAlPublicar } from '@/features/notificaciones/formaDeAvisar';

/**
 * En la app nativa las notificaciones van por Expo Push (push.ts): no hay
 * nada que activar acá. La versión web es celular.web.ts.
 */
export async function leerEstado(_conCuenta: boolean): Promise<EstadoAvisos> {
  return 'sinConfigurar';
}

export function dondeDesbloquear(): ComoDesbloquear {
  return 'computadora';
}

export function appDelNavegador(): AppConNavegador | null {
  return null;
}

export async function activar(_permiso: string): Promise<EstadoAvisos> {
  return 'sinConfigurar';
}

export async function desactivar(): Promise<void> {}

export async function olvidarEsteCelular(): Promise<void> {}

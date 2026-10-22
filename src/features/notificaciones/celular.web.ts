import { appConNavegador, type AppConNavegador } from '@/features/instalar/formaDeInstalar';
import {
  claveDelServidor,
  comoDesbloquear,
  type ComoDesbloquear,
  type DatosAvisos,
  estadoDeAvisos,
  type EstadoAvisos,
} from '@/features/notificaciones/formaDeAvisar';
import { ENV } from '@/lib/env';
import { supabase } from '@/lib/supabase';

// Los componentes (AvisosCelular) usan estas reglas desde acá: si las
// importaran ellos también, irían a __common, que se baja con la app.
export { ofrecerAlPublicar } from '@/features/notificaciones/formaDeAvisar';

/**
 * Notificaciones en el celular, en el navegador: el permiso, la suscripción
 * de push (con la clave VAPID pública) y su registro en la base. Se carga con
 * import() al abrir Perfil o al ofrecerlas después de publicar, nunca con la
 * app. Notification.requestPermission lo llama el botón, en el mismo toque
 * (Safari lo exige): acá llega el resultado.
 */

const COMO_APP = '(display-mode: standalone)';

function abiertaComoApp(): boolean {
  return (
    window.matchMedia(COMO_APP).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function soportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function datos(suscripto: boolean): DatosAvisos {
  return {
    plataforma: 'web',
    hayClave: claveDelServidor(ENV.vapidPublicKey) !== null,
    userAgent: navigator.userAgent,
    puntosDeToque: navigator.maxTouchPoints ?? 0,
    abiertaComoApp: abiertaComoApp(),
    soportaPush: soportaPush(),
    permiso: 'Notification' in window ? Notification.permission : 'default',
    suscripto,
  };
}

/**
 * La suscripción en la base. Va acá y no en api.ts, que se baja con la app: así
 * todo lo del push se carga al usarse. La base acepta solo servicios de push
 * conocidos y la RLS deja borrar solo las propias.
 */
async function guardarSuscripcionPush(endpoint: string, p256dh: string, auth: string) {
  const { error } = await supabase.rpc('guardar_suscripcion_push', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  });
  if (error) throw error;
}

async function borrarSuscripcionPush(endpoint: string) {
  const { error } = await supabase.from('suscripciones_push').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

/** El service worker de public/sw.js, activo (lo registra index.html; si no, acá). */
async function registro(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush()) return null;
  const actual = await navigator.serviceWorker.getRegistration();
  return (await actual?.pushManager.getSubscription()) ?? null;
}

async function guardar(suscripcion: PushSubscription): Promise<void> {
  const { endpoint, keys } = suscripcion.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Suscripción incompleta');
  await guardarSuscripcionPush(endpoint, keys.p256dh, keys.auth);
}

/**
 * Cómo está este navegador. Si ya está suscripto, vuelve a guardar la
 * suscripción a nombre de esta cuenta (por si el servicio la renovó o la base
 * la borró al vencer).
 */
export async function leerEstado(conCuenta: boolean): Promise<EstadoAvisos> {
  const previo = estadoDeAvisos(datos(false));
  if (previo !== 'ofrecer') return previo;
  const suscripcion = await suscripcionActual();
  const estado = estadoDeAvisos(datos(suscripcion !== null));
  if (estado === 'activadas' && conCuenta && suscripcion)
    await guardar(suscripcion).catch(() => {});
  return estado;
}

export function dondeDesbloquear(): ComoDesbloquear {
  return comoDesbloquear(datos(false));
}

/** WhatsApp, Instagram o Facebook, si está abierta en el navegador de una de esas apps. */
export function appDelNavegador(): AppConNavegador | null {
  return appConNavegador(navigator.userAgent);
}

/** Con el permiso ya pedido: suscribe este navegador y lo guarda para la cuenta. */
export async function activar(permiso: NotificationPermission): Promise<EstadoAvisos> {
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueadas' : 'ofrecer';
  const clave = claveDelServidor(ENV.vapidPublicKey);
  if (!clave) return 'sinConfigurar';
  const { pushManager } = await registro();
  let suscripcion = await pushManager.getSubscription();
  const opciones: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey: clave as Uint8Array<ArrayBuffer>,
  };
  try {
    suscripcion ??= await pushManager.subscribe(opciones);
  } catch (error) {
    // Una suscripción con otra clave (si cambió la VAPID): se reemplaza.
    if (!(error instanceof DOMException) || error.name !== 'InvalidStateError') throw error;
    await (await pushManager.getSubscription())?.unsubscribe();
    suscripcion = await pushManager.subscribe(opciones);
  }
  await guardar(suscripcion);
  return 'activadas';
}

/** Deja de avisar en este navegador: la borra de la base y del servicio de push. */
export async function desactivar(): Promise<void> {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return;
  await borrarSuscripcionPush(suscripcion.endpoint);
  await suscripcion.unsubscribe();
}

/**
 * Al cerrar sesión: este navegador deja de recibir los avisos de esta cuenta
 * (la próxima persona que lo use no los ve). Sin red, sigue igual: cerrar
 * sesión no puede fallar por esto.
 */
export async function olvidarEsteCelular(): Promise<void> {
  try {
    await desactivar();
  } catch {
    // La base la borra cuando el servicio de push la dé por vencida.
  }
}

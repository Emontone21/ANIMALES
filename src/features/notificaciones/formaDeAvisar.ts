/**
 * Notificaciones en el celular (Web Push): qué se puede ofrecer según el
 * navegador. Reglas puras, sin React ni el navegador: las prueba
 * __tests__/formaDeAvisar.test.ts.
 *
 * - `sinConfigurar`: la app nativa (usa Expo Push) o falta la clave VAPID.
 * - `abrirEnNavegador`: el navegador de WhatsApp, Instagram o Facebook, que no
 *   las muestra: hay que abrir el link en Chrome o Safari.
 * - `instalarPrimero`: iPhone o iPad sin la app instalada (Safari solo las
 *   muestra en la app de la pantalla de inicio).
 * - `noSoportado`: el navegador no tiene push.
 * - `bloqueadas`: la persona las bloqueó; se explica cómo volver a permitirlas.
 * - `activadas`: este navegador ya está suscripto.
 * - `ofrecer`: se puede pedir el permiso (siempre con un toque, nunca al abrir).
 */

import { appConNavegador, esIos } from '@/features/instalar/formaDeInstalar';

export type EstadoAvisos =
  | 'sinConfigurar'
  | 'abrirEnNavegador'
  | 'instalarPrimero'
  | 'noSoportado'
  | 'bloqueadas'
  | 'activadas'
  | 'ofrecer';

export type DatosAvisos = {
  /** Platform.OS. */
  plataforma: string;
  /** EXPO_PUBLIC_VAPID_PUBLIC_KEY está y tiene la forma de una clave. */
  hayClave: boolean;
  userAgent: string;
  puntosDeToque: number;
  /** Abierta como app instalada (display-mode standalone o navigator.standalone). */
  abiertaComoApp: boolean;
  /** serviceWorker, PushManager y Notification. */
  soportaPush: boolean;
  permiso: 'default' | 'granted' | 'denied';
  /** Hay una suscripción de push en este navegador. */
  suscripto: boolean;
};

export function estadoDeAvisos(d: DatosAvisos): EstadoAvisos {
  if (d.plataforma !== 'web' || !d.hayClave) return 'sinConfigurar';
  if (appConNavegador(d.userAgent)) return 'abrirEnNavegador';
  if (esIos(d.userAgent, d.puntosDeToque) && !d.abiertaComoApp) return 'instalarPrimero';
  if (!d.soportaPush) return 'noSoportado';
  if (d.permiso === 'denied') return 'bloqueadas';
  if (d.permiso === 'granted' && d.suscripto) return 'activadas';
  return 'ofrecer';
}

/** Después de publicar, solo se pregunta (o se explica cómo) si todavía se puede activar. */
export function ofrecerAlPublicar(estado: EstadoAvisos): boolean {
  return estado === 'ofrecer' || estado === 'instalarPrimero' || estado === 'abrirEnNavegador';
}

export type ComoDesbloquear = 'iphone' | 'androidApp' | 'android' | 'computadora';

/** Dónde se vuelven a permitir: los ajustes del iPhone, de la app en Android o del sitio. */
export function comoDesbloquear(
  d: Pick<DatosAvisos, 'userAgent' | 'puntosDeToque' | 'abiertaComoApp'>,
): ComoDesbloquear {
  if (esIos(d.userAgent, d.puntosDeToque)) return 'iphone';
  if (/Android/i.test(d.userAgent)) return d.abiertaComoApp ? 'androidApp' : 'android';
  return 'computadora';
}

/**
 * La clave VAPID pública (base64url) como la pide pushManager.subscribe: los
 * 65 bytes de un punto de P-256 sin comprimir. null si no tiene esa forma.
 */
export function claveDelServidor(clave: string | null | undefined): Uint8Array | null {
  const limpia = clave?.trim().replace(/=+$/, '') ?? '';
  if (!/^[A-Za-z0-9_-]{87}$/.test(limpia)) return null;
  const base64 = limpia.replace(/-/g, '+').replace(/_/g, '/') + '=';
  const binario = atob(base64);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return bytes.length === 65 && bytes[0] === 4 ? bytes : null;
}

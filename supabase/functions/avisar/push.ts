/**
 * El envío a los servicios de push de los navegadores, con @negrel/webpush
 * (MIT): cifra el mensaje para cada suscripción (RFC 8291) y firma el pedido
 * con las claves VAPID (RFC 8292).
 *
 * Las claves vienen del entorno (secretos de la función, nunca en el repo):
 * VAPID_PUBLIC_KEY, la misma de EXPO_PUBLIC_VAPID_PUBLIC_KEY (65 bytes en
 * base64url), y VAPID_PRIVATE_KEY (los 32 bytes del escalar, en base64url).
 */

import { ApplicationServer, importVapidKeys, PushMessageError, Urgency } from '@negrel/webpush';

import type { Mensaje, Opciones, Suscripcion } from './aviso.ts';

/** Igual que es_endpoint_push en la base (migración 0024). */
const FORMA_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/;

export function esEndpointPush(endpoint: string): boolean {
  return endpoint.length <= 1024 && FORMA_ENDPOINT.test(endpoint);
}

/**
 * ok: el servicio lo aceptó (201). vencida: la suscripción ya no existe (404 o
 * 410) o sus claves no sirven; se borra. error: otra cosa (se intenta con el
 * próximo aviso).
 */
export type ResultadoEnvio = 'ok' | 'vencida' | 'error';

export type Enviar = (suscripcion: Suscripcion, mensaje: Mensaje, opciones: Opciones) => Promise<ResultadoEnvio>;

/** Un servicio que no contesta no frena al resto. */
export const ESPERA_MS = 10_000;

function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function deBase64url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replaceAll('-', '+').replaceAll('_', '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export class ErrorClaves extends Error {
  constructor() {
    super('Las claves VAPID no son un par válido');
    this.name = 'ErrorClaves';
  }
}

/** Las claves VAPID del entorno, comprobadas: la privada firma lo que verifica la pública. */
export async function importarClaves(publica: string, privada: string): Promise<CryptoKeyPair> {
  let claves: CryptoKeyPair;
  try {
    const punto = deBase64url(publica.trim());
    const escalar = deBase64url(privada.trim());
    if (punto.length !== 65 || punto[0] !== 4 || escalar.length !== 32) throw new ErrorClaves();
    const comun = { kty: 'EC', crv: 'P-256', x: base64url(punto.slice(1, 33)), y: base64url(punto.slice(33)) };
    claves = await importVapidKeys({ publicKey: comun, privateKey: { ...comun, d: base64url(escalar) } });
  } catch {
    throw new ErrorClaves();
  }
  const prueba = new TextEncoder().encode('spot');
  const algoritmo = { name: 'ECDSA', hash: 'SHA-256' };
  const firma = await crypto.subtle.sign(algoritmo, claves.privateKey, prueba);
  if (!(await crypto.subtle.verify(algoritmo, claves.publicKey, firma, prueba))) throw new ErrorClaves();
  return claves;
}

/**
 * La clave del navegador tiene que ser un punto de P-256 y el secreto, de 16
 * bytes: si no, la suscripción nunca va a servir.
 */
async function suscripcionValida(suscripcion: Suscripcion): Promise<boolean> {
  try {
    const punto = deBase64url(suscripcion.p256dh);
    if (punto.length !== 65 || deBase64url(suscripcion.auth).length !== 16) return false;
    const clave = await crypto.subtle.importKey('raw', punto, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    // Importar no siempre comprueba que el punto esté en la curva: derivar sí.
    const prueba = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clave }, prueba.privateKey, 256);
    return true;
  } catch {
    return false;
  }
}

/**
 * contacto: el "sub" del token VAPID (una URL https o un mailto:), para que el
 * servicio de push sepa a quién avisar si algo anda mal.
 */
export function crearEnviador(claves: CryptoKeyPair, contacto: string, esperaMs = ESPERA_MS): Enviar {
  return async (suscripcion, mensaje, opciones) => {
    if (!esEndpointPush(suscripcion.endpoint) || !(await suscripcionValida(suscripcion))) return 'vencida';
    // Un par de claves de cifrado nuevo por mensaje (lo genera ApplicationServer.new).
    const servidor = await ApplicationServer.new({ contactInformation: contacto, vapidKeys: claves });
    const suscriptor = servidor.subscribe({
      endpoint: suscripcion.endpoint,
      keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
    });
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const vencio = new Promise<'error'>((resolver) => {
      reloj = setTimeout(() => resolver('error'), esperaMs);
    });
    const envio = suscriptor
      .pushTextMessage(JSON.stringify(mensaje), {
        urgency: opciones.urgencia === 'high' ? Urgency.High : Urgency.Normal,
        ttl: opciones.ttl,
        topic: opciones.topic,
      })
      .then((): ResultadoEnvio => 'ok')
      .catch(async (error: unknown): Promise<ResultadoEnvio> => {
        if (error instanceof PushMessageError) {
          const estado = error.response.status;
          await error.response.body?.cancel();
          return estado === 404 || estado === 410 ? 'vencida' : 'error';
        }
        return 'error';
      });
    try {
      return await Promise.race([envio, vencio]);
    } finally {
      clearTimeout(reloj);
    }
  };
}

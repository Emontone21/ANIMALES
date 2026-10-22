/**
 * Ayudas de las pruebas: claves VAPID de prueba, suscriptores (un navegador
 * con su par de claves y su secreto) y un servicio de push simulado que hace
 * lo que el de verdad: verifica el token VAPID y descifra el mensaje (RFC 8291)
 * con la clave privada del navegador, para que las pruebas lean lo que vería el
 * celular. Responde 201, o 404/410 si la suscripción venció.
 */

import type { Aviso, Suscripcion } from '../aviso.ts';
import type { Base, Config, ResultadoParaGuardar } from '../base.ts';

export const SECRETO = 'a1'.repeat(32);

const texto = new TextEncoder();

export function base64url(bytes: Uint8Array | ArrayBuffer): string {
  let binario = '';
  for (const b of new Uint8Array(bytes)) binario += String.fromCharCode(b);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function deBase64url(valor: string): Uint8Array<ArrayBuffer> {
  const base64 = valor.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/** Un par VAPID nuevo, como lo cargaría el cierre: la pública cruda y el escalar privado. */
export async function clavesVapid(): Promise<{ publica: string; privada: string }> {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publica = base64url(await crypto.subtle.exportKey('raw', par.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica, privada: jwk.d as string };
}

export type Suscriptor = {
  suscripcion: Suscripcion;
  clavePrivada: CryptoKey;
  publicaCruda: Uint8Array<ArrayBuffer>;
  secreto: Uint8Array<ArrayBuffer>;
};

let siguiente = 0;

/** Un navegador suscripto, con su endpoint de FCM (o el que se pida). */
export async function suscriptor(endpoint?: string): Promise<Suscriptor> {
  siguiente++;
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicaCruda = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const secreto = crypto.getRandomValues(new Uint8Array(16));
  return {
    suscripcion: {
      id: `00000000-0000-4000-8000-${String(siguiente).padStart(12, '0')}`,
      endpoint: endpoint ?? `https://fcm.googleapis.com/fcm/send/prueba-${siguiente}`,
      p256dh: base64url(publicaCruda),
      auth: base64url(secreto),
    },
    clavePrivada: par.privateKey,
    publicaCruda,
    secreto,
  };
}

async function hmac(clave: Uint8Array<ArrayBuffer>, datos: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}

function unir(...partes: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const salida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

/** Descifra un cuerpo aes128gcm de Web Push (RFC 8291 y 8188) como el navegador. */
export async function descifrar(cuerpo: Uint8Array<ArrayBuffer>, s: Suscriptor): Promise<string> {
  const sal = cuerpo.slice(0, 16);
  const largoId = cuerpo[20];
  const publicaServidor = cuerpo.slice(21, 21 + largoId);
  const cifrado = cuerpo.slice(21 + largoId);
  const claveServidor = await crypto.subtle.importKey(
    'raw',
    publicaServidor,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const compartido = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: claveServidor }, s.clavePrivada, 256),
  );
  const prkClave = await hmac(s.secreto, compartido);
  const info = unir(texto.encode('WebPush: info\0'), s.publicaCruda, publicaServidor, new Uint8Array([1]));
  const ikm = await hmac(prkClave, info);
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, unir(texto.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, unir(texto.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const clave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plano = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, clave, cifrado));
  // Último registro: el mensaje, el delimitador 2 y el relleno con ceros.
  let fin = plano.length - 1;
  while (fin >= 0 && plano[fin] === 0) fin--;
  if (plano[fin] !== 2) throw new Error('falta el delimitador del último registro');
  return new TextDecoder().decode(plano.slice(0, fin));
}

/** Verifica el header "Authorization: vapid t=<jwt>, k=<clave>" como un servicio de push. */
async function verificarVapid(autorizacion: string, endpoint: string): Promise<Record<string, unknown>> {
  const partes = /^vapid t=([^,]+), k=(.+)$/.exec(autorizacion);
  if (!partes) throw new Error('sin token VAPID');
  const [cabecera, carga, firma] = partes[1].split('.');
  const clave = await crypto.subtle.importKey(
    'raw',
    deBase64url(partes[2]),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const valida = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    clave,
    deBase64url(firma),
    texto.encode(`${cabecera}.${carga}`),
  );
  if (!valida) throw new Error('firma VAPID inválida');
  const datos = JSON.parse(new TextDecoder().decode(deBase64url(carga)));
  if (datos.aud !== new URL(endpoint).origin) throw new Error('aud no es el origen del endpoint');
  if (typeof datos.exp !== 'number' || datos.exp * 1000 < Date.now() || datos.exp * 1000 > Date.now() + 86_400_000) {
    throw new Error('exp fuera de las 24 h');
  }
  return { ...datos, k: partes[2] };
}

export type Recibido = {
  endpoint: string;
  headers: Record<string, string>;
  vapid: Record<string, unknown>;
  mensaje: Record<string, unknown>;
};

/** El servicio de push simulado: reemplaza a fetch mientras corre la prueba. */
export class ServicioPush {
  readonly recibidos: Recibido[] = [];
  readonly #suscriptores = new Map<string, Suscriptor>();
  readonly #estados = new Map<string, number>();

  registrar(s: Suscriptor, estado = 201) {
    this.#suscriptores.set(s.suscripcion.endpoint, s);
    this.#estados.set(s.suscripcion.endpoint, estado);
  }

  readonly fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pedido = new Request(entrada, init);
    const s = this.#suscriptores.get(pedido.url);
    if (!s) return new Response('no existe', { status: 404 });
    const estado = this.#estados.get(pedido.url) ?? 201;
    if (estado !== 201) return new Response('vencida', { status: estado });
    const headers = Object.fromEntries(pedido.headers.entries());
    const vapid = await verificarVapid(headers.authorization ?? '', pedido.url);
    const mensaje = JSON.parse(await descifrar(new Uint8Array(await pedido.arrayBuffer()), s));
    this.recibidos.push({ endpoint: pedido.url, headers, vapid, mensaje });
    return new Response(null, { status: 201 });
  };

  /** Corre fn con este servicio en lugar de fetch (la librería usa el fetch global). */
  async con<T>(fn: () => Promise<T>): Promise<T> {
    const original = globalThis.fetch;
    globalThis.fetch = this.fetch;
    try {
      return await fn();
    } finally {
      globalThis.fetch = original;
    }
  }
}

let siguienteAviso = 0;

export function aviso(cambios: Partial<Aviso> = {}): Aviso {
  siguienteAviso++;
  return {
    aviso_id: siguienteAviso,
    tipo: 'avistamiento',
    evento: 'visto',
    animal_id: '11111111-2222-4333-8444-555555555555',
    conversacion_id: null,
    reporte_error_id: null,
    moderacion: false,
    nombre: 'Toby',
    especie: 'perro',
    para_familia: false,
    suscripciones: [],
    ...cambios,
  };
}

/** La base en memoria: preparar devuelve las tandas que se le cargan, en orden. */
export class BaseFalsa implements Base {
  config_: Config = { secreto: SECRETO };
  tandas: Aviso[][] = [];
  terminados: ResultadoParaGuardar[][] = [];
  consultasConfig = 0;
  pedidosPreparar = 0;

  config() {
    this.consultasConfig++;
    return Promise.resolve(this.config_);
  }

  preparar(_limite: number) {
    this.pedidosPreparar++;
    return Promise.resolve(this.tandas.shift() ?? []);
  }

  terminar(resultados: ResultadoParaGuardar[]) {
    this.terminados.push(resultados);
    return Promise.resolve();
  }
}

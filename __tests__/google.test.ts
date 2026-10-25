/**
 * @jest-environment node
 */
// Node trae crypto.subtle (SHA-256), igual que el navegador.
import { createHash } from 'node:crypto';

import {
  crearNonce,
  formaDeIngresarConGoogle,
  hashDelNonce,
  ingresarConTokenDeGoogle,
  prepararNonce,
} from '@/features/auth/google';
import {
  crearCargadorGoogle,
  ESPERA_GOOGLE_MS,
  type IdentidadGoogle,
  SCRIPT_GOOGLE,
  type ScriptGoogle,
} from '@/features/auth/scriptGoogle';
import { ErrorAuth } from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}));

const ingresarConIdToken = supabase.auth.signInWithIdToken as jest.Mock;

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  whatsapp:
    'Mozilla/5.0 (Linux; Android 14; SM-A145M Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.20.89',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; es_UY)',
  facebook:
    'Mozilla/5.0 (Linux; Android 14; moto g54) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
};

const EN_WEB = {
  plataforma: 'web',
  userAgent: UA.chromeAndroid,
  clientId: '123-abc.apps.googleusercontent.com',
  script: 'listo' as const,
};

describe('el nonce: el original para Supabase y su hash SHA-256 para Google', () => {
  test('32 bytes al azar, en hexadecimal, distinto cada vez', () => {
    const nonce = crearNonce();
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(crearNonce()).not.toBe(nonce);
    expect(crearNonce((bytes) => bytes.fill(171))).toBe('ab'.repeat(32));
  });

  test('el hash es el SHA-256 en hexadecimal del original', async () => {
    expect(await hashDelNonce('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    const nonce = await prepararNonce();
    expect(nonce.hash).toBe(sha256(nonce.original));
    expect(nonce.hash).not.toBe(nonce.original);
  });
});

describe('qué se muestra para entrar con Google', () => {
  test('en web, con el ID de cliente: el botón de Google cuando cargó el script', () => {
    expect(formaDeIngresarConGoogle(EN_WEB)).toBe('boton');
    expect(formaDeIngresarConGoogle({ ...EN_WEB, userAgent: UA.safariIphone })).toBe('boton');
    expect(formaDeIngresarConGoogle({ ...EN_WEB, script: 'cargando' })).toBe('cargando');
  });

  test('respaldo (el botón de siempre): si el script no cargó o falló, sin ID de cliente o en nativo', () => {
    expect(formaDeIngresarConGoogle({ ...EN_WEB, script: 'fallo' })).toBe('respaldo');
    expect(formaDeIngresarConGoogle({ ...EN_WEB, clientId: null })).toBe('respaldo');
    expect(formaDeIngresarConGoogle({ ...EN_WEB, plataforma: 'android' })).toBe('respaldo');
    expect(formaDeIngresarConGoogle({ ...EN_WEB, plataforma: 'ios' })).toBe('respaldo');
  });

  test('en el navegador de WhatsApp, Instagram o Facebook: abrir el link en Chrome o Safari', () => {
    for (const userAgent of [UA.whatsapp, UA.instagram, UA.facebook]) {
      expect(formaDeIngresarConGoogle({ ...EN_WEB, userAgent })).toBe('abrirEnNavegador');
      // Tampoco el botón de siempre: Google no deja ingresar desde esos navegadores.
      expect(formaDeIngresarConGoogle({ ...EN_WEB, userAgent, script: 'fallo' })).toBe(
        'abrirEnNavegador',
      );
      expect(formaDeIngresarConGoogle({ ...EN_WEB, userAgent, clientId: null })).toBe(
        'abrirEnNavegador',
      );
    }
    expect(t.auth.google.navegadorInterno('WhatsApp')).toContain('Chrome o Safari');
    expect(t.auth.google.navegadorInterno('WhatsApp')).toContain('WhatsApp');
  });
});

describe('el script de Google: si no carga o falla, el respaldo', () => {
  const identidad = { initialize: jest.fn(), renderButton: jest.fn() } as IdentidadGoogle;

  function entornoDePrueba() {
    const scripts: (ScriptGoogle & { quitado: boolean })[] = [];
    let cargada: IdentidadGoogle | undefined;
    return {
      scripts,
      cargarIdentidad: () => {
        cargada = identidad;
      },
      entorno: {
        crearScript: () => {
          const script = {
            src: '',
            async: false,
            onload: null,
            onerror: null,
            quitado: false,
            remove: () => {
              script.quitado = true;
            },
          } as ScriptGoogle & { quitado: boolean };
          scripts.push(script);
          return script;
        },
        agregar: () => undefined,
        identidad: () => cargada,
      },
    };
  }

  afterEach(() => jest.useRealTimers());

  test('lo baja de accounts.google.com, una sola vez, y devuelve google.accounts.id', async () => {
    const prueba = entornoDePrueba();
    const cargar = crearCargadorGoogle(prueba.entorno);
    const primera = cargar();
    const segunda = cargar();
    expect(prueba.scripts).toHaveLength(1);
    expect(prueba.scripts[0]).toMatchObject({ src: SCRIPT_GOOGLE, async: true });
    expect(SCRIPT_GOOGLE).toBe('https://accounts.google.com/gsi/client');
    prueba.cargarIdentidad();
    prueba.scripts[0]?.onload?.();
    await expect(primera).resolves.toBe(identidad);
    await expect(segunda).resolves.toBe(identidad);
    // Ya cargado, no lo vuelve a pedir.
    await expect(cargar()).resolves.toBe(identidad);
    expect(prueba.scripts).toHaveLength(1);
  });

  test('si el script no carga, falla, lo saca y deja intentar de nuevo', async () => {
    const prueba = entornoDePrueba();
    const cargar = crearCargadorGoogle(prueba.entorno);
    const intento = cargar();
    prueba.scripts[0]?.onerror?.();
    await expect(intento).rejects.toThrow('google');
    expect(prueba.scripts[0]?.quitado).toBe(true);
    const otro = cargar();
    expect(prueba.scripts).toHaveLength(2);
    prueba.scripts[1]?.onerror?.();
    await expect(otro).rejects.toThrow('google');
  });

  test('si carga pero no trae la API, falla', async () => {
    const prueba = entornoDePrueba();
    const intento = crearCargadorGoogle(prueba.entorno)();
    prueba.scripts[0]?.onload?.();
    await expect(intento).rejects.toThrow('google');
  });

  test('si tarda demasiado, falla', async () => {
    jest.useFakeTimers();
    const prueba = entornoDePrueba();
    const intento = crearCargadorGoogle(prueba.entorno)();
    jest.advanceTimersByTime(ESPERA_GOOGLE_MS);
    await expect(intento).rejects.toThrow('google');
    expect(prueba.scripts[0]?.quitado).toBe(true);
  });
});

describe('ingresar con el token de Google', () => {
  beforeEach(() => ingresarConIdToken.mockReset());

  test('llama a signInWithIdToken con el token de Google y el nonce original, no el hash', async () => {
    ingresarConIdToken.mockResolvedValue({ data: {}, error: null });
    const nonce = await prepararNonce();
    await ingresarConTokenDeGoogle('token.de.google', nonce);
    expect(ingresarConIdToken).toHaveBeenCalledTimes(1);
    expect(ingresarConIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'token.de.google',
      nonce: nonce.original,
    });
    // Lo que le llega a Supabase, hasheado, es lo que se le dio a Google.
    const enviado = ingresarConIdToken.mock.calls[0][0] as { nonce: string };
    expect(sha256(enviado.nonce)).toBe(nonce.hash);
  });

  test('un error de Supabase llega en español', async () => {
    ingresarConIdToken.mockResolvedValue({
      data: {},
      error: { message: 'Request rate limit reached', status: 429 },
    });
    const intento = ingresarConTokenDeGoogle('token.de.google', await prepararNonce());
    await expect(intento).rejects.toBeInstanceOf(ErrorAuth);
    await expect(intento).rejects.toThrow(t.auth.errores.muchosIntentos);
  });
});

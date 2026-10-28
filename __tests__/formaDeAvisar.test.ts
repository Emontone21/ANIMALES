import { formaDeInstalar } from '@/features/instalar/formaDeInstalar';
import {
  claveDelServidor,
  comoDesbloquear,
  type DatosAvisos,
  estadoDeAvisos,
  ofrecerAlPublicar,
} from '@/features/notificaciones/formaDeAvisar';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_COMO_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WHATSAPP = `${ANDROID} WhatsApp/2.24.1`;
const INSTAGRAM_IPHONE = `${IPHONE} Instagram 300.0.0`;
const COMPU =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function datos(cambios: Partial<DatosAvisos> = {}): DatosAvisos {
  return {
    plataforma: 'web',
    hayClave: true,
    userAgent: ANDROID,
    puntosDeToque: 5,
    abiertaComoApp: false,
    soportaPush: true,
    permiso: 'default',
    suscripto: false,
    ...cambios,
  };
}

describe('qué ofrecer para las notificaciones del celular', () => {
  test('Android en Chrome: se ofrece; con permiso y suscripción, activadas', () => {
    expect(estadoDeAvisos(datos())).toBe('ofrecer');
    expect(estadoDeAvisos(datos({ permiso: 'granted', suscripto: true }))).toBe('activadas');
    // Con permiso pero sin suscripción (se borró): se vuelve a ofrecer.
    expect(estadoDeAvisos(datos({ permiso: 'granted' }))).toBe('ofrecer');
  });

  test('la app nativa o sin la clave VAPID: no hay nada que ofrecer', () => {
    expect(estadoDeAvisos(datos({ plataforma: 'android' }))).toBe('sinConfigurar');
    expect(estadoDeAvisos(datos({ hayClave: false }))).toBe('sinConfigurar');
  });

  test('iPhone: solo con la app instalada', () => {
    expect(estadoDeAvisos(datos({ userAgent: IPHONE, soportaPush: false }))).toBe(
      'instalarPrimero',
    );
    expect(estadoDeAvisos(datos({ userAgent: IPAD_COMO_MAC, soportaPush: false }))).toBe(
      'instalarPrimero',
    );
    expect(estadoDeAvisos(datos({ userAgent: IPHONE, abiertaComoApp: true }))).toBe('ofrecer');
    // Un iPhone viejo (antes de iOS 16.4) instalada: no puede.
    expect(
      estadoDeAvisos(datos({ userAgent: IPHONE, abiertaComoApp: true, soportaPush: false })),
    ).toBe('noSoportado');
  });

  test('los navegadores de WhatsApp, Instagram y Facebook: abrir en Chrome o Safari', () => {
    expect(estadoDeAvisos(datos({ userAgent: WHATSAPP }))).toBe('abrirEnNavegador');
    expect(estadoDeAvisos(datos({ userAgent: INSTAGRAM_IPHONE, soportaPush: false }))).toBe(
      'abrirEnNavegador',
    );
  });

  test('bloqueadas: se explica cómo volver a permitirlas, donde corresponde', () => {
    expect(estadoDeAvisos(datos({ permiso: 'denied' }))).toBe('bloqueadas');
    expect(comoDesbloquear(datos({ userAgent: IPHONE, abiertaComoApp: true }))).toBe('iphone');
    expect(comoDesbloquear(datos({ abiertaComoApp: true }))).toBe('androidApp');
    expect(comoDesbloquear(datos())).toBe('android');
    expect(comoDesbloquear(datos({ userAgent: COMPU, puntosDeToque: 0 }))).toBe('computadora');
  });

  test('después de publicar: solo si todavía se pueden activar', () => {
    expect(ofrecerAlPublicar('ofrecer')).toBe(true);
    expect(ofrecerAlPublicar('instalarPrimero')).toBe(true);
    expect(ofrecerAlPublicar('abrirEnNavegador')).toBe(true);
    for (const estado of ['activadas', 'bloqueadas', 'noSoportado', 'sinConfigurar'] as const) {
      expect(ofrecerAlPublicar(estado)).toBe(false);
    }
  });
});

describe('en Perfil, un solo botón para instalar o abrir en el navegador', () => {
  // El interruptor de Perfil explica qué hacer sin botón propio: el botón es
  // "Instalar la app" de Perfil, que abre la misma hoja. Si un día Perfil no lo
  // mostrara en alguno de estos casos, la explicación quedaría sin botón.
  const BOTON_DE_PERFIL: Record<string, string> = {
    instalarPrimero: 'pasosIos',
    abrirEnNavegador: 'abrirEnNavegador',
  };

  test.each([
    ['iPhone en Safari', IPHONE, 5],
    ['iPad que dice ser una Mac', IPAD_COMO_MAC, 5],
    ['WhatsApp en Android', WHATSAPP, 5],
    ['Instagram en iPhone', INSTAGRAM_IPHONE, 5],
  ])(
    '%s: lo que explica el interruptor lo cubre el botón de Perfil',
    (_, userAgent, puntosDeToque) => {
      const estado = estadoDeAvisos(datos({ userAgent, puntosDeToque }));
      expect(Object.keys(BOTON_DE_PERFIL)).toContain(estado);
      const enPerfil = formaDeInstalar({
        plataforma: 'web',
        userAgent,
        puntosDeToque,
        abiertaComoApp: false,
        recienInstalada: false,
        hayAviso: false,
      });
      expect(enPerfil).toBe(BOTON_DE_PERFIL[estado]);
    },
  );
});

describe('la clave VAPID pública', () => {
  // Un punto sin comprimir: 0x04 y 64 bytes (no hace falta que esté en la curva para la forma).
  const bytes = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
  const base64url = Buffer.from(bytes).toString('base64url');

  test('se pasa a los 65 bytes que pide pushManager.subscribe', () => {
    expect(base64url).toHaveLength(87);
    expect(Array.from(claveDelServidor(base64url) ?? [])).toEqual(Array.from(bytes));
    expect(Array.from(claveDelServidor(`  ${base64url}=  `) ?? [])).toEqual(Array.from(bytes));
  });

  test('sin clave o con otra forma, null (la app no ofrece notificaciones)', () => {
    expect(claveDelServidor(null)).toBeNull();
    expect(claveDelServidor('')).toBeNull();
    expect(claveDelServidor(base64url.slice(1))).toBeNull();
    expect(claveDelServidor(Buffer.from(new Uint8Array(65)).toString('base64url'))).toBeNull();
    expect(claveDelServidor(base64url.replace(/./, '+'))).toBeNull();
  });
});

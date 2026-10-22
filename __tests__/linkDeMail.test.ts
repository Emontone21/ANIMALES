/**
 * Los links de los mails (/auth/confirmar?token_hash=…&type=…): sirven en
 * cualquier navegador y el link de otra cuenta no deja a nadie con una sesión
 * abierta sin darse cuenta (src/features/auth/linkDeMail.ts y recuperacion.ts).
 */
// Cada createClient da un cliente nuevo: el primero es el de la app
// (src/lib/supabase.ts); los demás, los de un uso de cada link.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      verifyOtp: jest.fn((params: unknown) => mockVerificar(params)),
      signOut: jest.fn(async () => ({ error: null })),
      updateUser: jest.fn(async () => ({ data: { user: { id: 'u-b' } }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: mockSesion } })),
      setSession: jest.fn(async () => ({ error: null })),
      exchangeCodeForSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  })),
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-linking', () => ({ createURL: (ruta: string) => `spotmvd://${ruta}` }));

import { cambiarContrasena } from '@/features/auth/acciones';
import { abrirLinkDeMail, pantallaDelLink } from '@/features/auth/linkDeMail';
import {
  cancelarRecuperacion,
  terminarRecuperacion,
  useRecuperacion,
} from '@/features/auth/recuperacion';
import { ErrorAuth } from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';
import { enmascararEmail, leerParametros, linkDeMail } from '@/lib/urlAuth';

type AuthFalso = Record<string, jest.Mock>;

const mockVerificar = jest.fn();
let mockSesion: unknown = null;

const createClient = jest.requireMock('@supabase/supabase-js').createClient as jest.Mock;
const clientes = () => createClient.mock.results.map((r) => r.value.auth as AuthFalso);
const app = () => clientes()[0];
/** El último cliente de un uso que se creó (el del link que se acaba de abrir). */
const delLink = () => clientes().at(-1) as AuthFalso;

// recuperacion.ts se suscribe a la sesión de la app al cargarse (el link viejo,
// con PASSWORD_RECOVERY): se guarda antes de que beforeEach limpie las llamadas.
const alCambiarLaSesion = app().onAuthStateChange.mock.calls[0]?.[0] as (
  evento: string,
  sesion: unknown,
) => void;

/** Una sesión de la cuenta de otra persona, como la devuelve verifyOtp. */
const sesionDe = (email: string) => ({
  access_token: `acceso-${email}`,
  refresh_token: `refresco-${email}`,
  user: { id: `id-${email}`, email },
});

let numero = 0;
/** Un token distinto en cada prueba: un link se canjea una sola vez. */
const link = (tipo: 'signup' | 'recovery' | 'email_change') => ({
  tokenHash: `pkce_${tipo}${(numero += 1)}abcdef0123`,
  tipo,
});

beforeEach(() => {
  mockVerificar.mockReset();
  mockSesion = null;
  terminarRecuperacion();
  for (const auth of clientes()) for (const fn of Object.values(auth)) fn.mockClear();
});

describe('el link del mail en la URL', () => {
  const de = (url: string) => linkDeMail(leerParametros(url));

  test('token_hash y type de las plantillas', () => {
    expect(de('https://spot.test/auth/confirmar?token_hash=pkce_ab12cd34ef&type=recovery')).toEqual(
      { tokenHash: 'pkce_ab12cd34ef', tipo: 'recovery' },
    );
    expect(de('https://spot.test/auth/confirmar?token_hash=ab12cd34ef56&type=signup')?.tipo).toBe(
      'signup',
    );
    expect(
      de('https://spot.test/auth/confirmar?token_hash=ab12cd34ef56&type=email_change')?.tipo,
    ).toBe('email_change');
  });

  test('sin token, con otro tipo (también el enlace mágico) o con caracteres raros, no vale', () => {
    expect(de('https://spot.test/auth/confirmar?type=signup')).toBeNull();
    expect(de('https://spot.test/auth/confirmar?token_hash=ab12cd34ef56')).toBeNull();
    expect(
      de('https://spot.test/auth/confirmar?token_hash=ab12cd34ef56&type=magiclink'),
    ).toBeNull();
    expect(de('https://spot.test/auth/confirmar?token_hash=ab12cd34ef56&type=invite')).toBeNull();
    expect(de('https://spot.test/auth/confirmar?token_hash=ab"><script&type=signup')).toBeNull();
    expect(de('https://spot.test/auth/confirmar?token_hash=corto&type=signup')).toBeNull();
  });

  test('un parámetro repetido (como lo da Expo Router) no vale', () => {
    expect(linkDeMail({ token_hash: 'ab12cd34ef56', type: ['signup', 'recovery'] })).toBeNull();
    expect(linkDeMail({ token_hash: ['ab12cd34ef56', 'ff12cd34ef56'], type: 'signup' })).toBeNull();
  });
});

describe('enmascararEmail', () => {
  test('la primera letra, *** y el dominio', () => {
    expect(enmascararEmail('eva.perez@correo.example')).toBe('e***@correo.example');
    expect(enmascararEmail('ñandú@correo.example')).toBe('ñ***@correo.example');
    expect(enmascararEmail('a@b.example')).toBe('a***@b.example');
  });

  test('sin un email con forma, solo ***', () => {
    expect(enmascararEmail(null)).toBe('***');
    expect(enmascararEmail('')).toBe('***');
    expect(enmascararEmail('sin-arroba')).toBe('***');
    expect(enmascararEmail('@example.com')).toBe('***');
    expect(enmascararEmail('alguien@')).toBe('***');
  });
});

describe('confirmar la cuenta o el email, en otro navegador', () => {
  test('confirma la cuenta y no deja ninguna sesión abierta', async () => {
    mockVerificar.mockResolvedValue({ data: sesionYUsuario('b@example.com'), error: null });
    const l = link('signup');
    await expect(abrirLinkDeMail(l)).resolves.toEqual({ tipo: 'cuentaConfirmada' });

    expect(delLink().verifyOtp).toHaveBeenCalledWith({ token_hash: l.tokenHash, type: 'signup' });
    // La sesión que abrió el link se cierra en Supabase, solo esa.
    expect(delLink().signOut).toHaveBeenCalledWith({ scope: 'local' });
    // La app nunca la tuvo.
    expect(app().setSession).not.toHaveBeenCalled();
    expect(app().verifyOtp).not.toHaveBeenCalled();
    expect(useRecuperacion.getState().activa).toBe(false);
  });

  test('el cliente del link no guarda la sesión ni lee la URL', async () => {
    mockVerificar.mockResolvedValue({ data: sesionYUsuario('b@example.com'), error: null });
    await abrirLinkDeMail(link('signup'));
    const opciones = createClient.mock.calls.at(-1)?.[2] as { auth: Record<string, unknown> };
    expect(opciones.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
    const claves = createClient.mock.calls.slice(1).map((c) => (c[2] as typeof opciones).auth);
    // Cada uno con su clave: si no, supabase-js avisa que hay dos clientes.
    expect(new Set(claves.map((a) => a.storageKey)).size).toBe(claves.length);
  });

  test('el cambio de email: con las dos confirmaciones, listo; con una, falta la otra', async () => {
    mockVerificar.mockResolvedValue({ data: sesionYUsuario('nuevo@example.com'), error: null });
    await expect(abrirLinkDeMail(link('email_change'))).resolves.toEqual({
      tipo: 'emailCambiado',
    });
    expect(delLink().signOut).toHaveBeenCalledWith({ scope: 'local' });

    // La primera de las dos: Supabase responde {msg, code}, sin sesión.
    mockVerificar.mockResolvedValue({
      data: { session: null, user: { msg: 'Confirmation link accepted.', code: '200' } },
      error: null,
    });
    await expect(abrirLinkDeMail(link('email_change'))).resolves.toEqual({
      tipo: 'faltaElOtroEmail',
    });
    expect(delLink().signOut).not.toHaveBeenCalled();
    expect(app().setSession).not.toHaveBeenCalled();
  });

  test('un link vencido o ya usado', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email link is invalid or has expired', status: 403, code: 'otp_expired' },
    });
    await expect(abrirLinkDeMail(link('signup'))).resolves.toEqual({
      tipo: 'vencido',
      link: 'signup',
    });
    await expect(abrirLinkDeMail(link('recovery'))).resolves.toEqual({
      tipo: 'vencido',
      link: 'recovery',
    });
    expect(useRecuperacion.getState().activa).toBe(false);
  });

  test('sin conexión no gasta el link: se puede probar de nuevo', async () => {
    const l = link('signup');
    mockVerificar.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 },
    });
    await expect(abrirLinkDeMail(l)).rejects.toEqual(new ErrorAuth(t.comunes.sinConexion));
    mockVerificar.mockResolvedValueOnce({ data: sesionYUsuario('b@example.com'), error: null });
    await expect(abrirLinkDeMail(l)).resolves.toEqual({ tipo: 'cuentaConfirmada' });
    expect(mockVerificar).toHaveBeenCalledTimes(2);
  });

  test('si falla el servidor o hay muchos pedidos, lo dice y no lo da por vencido', async () => {
    mockVerificar.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', message: 'Internal Server Error', status: 500 },
    });
    await expect(abrirLinkDeMail(link('recovery'))).rejects.toEqual(
      new ErrorAuth(t.auth.confirmar.errorServidor),
    );
    mockVerificar.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', message: 'Too many requests', status: 429 },
    });
    await expect(abrirLinkDeMail(link('signup'))).rejects.toEqual(
      new ErrorAuth(t.auth.errores.muchosIntentos),
    );
    expect(useRecuperacion.getState().activa).toBe(false);
  });

  test('la pantalla montada dos veces canjea el link una sola vez', async () => {
    mockVerificar.mockResolvedValue({ data: sesionYUsuario('b@example.com'), error: null });
    const l = link('signup');
    const [a, b] = await Promise.all([abrirLinkDeMail(l), abrirLinkDeMail(l)]);
    expect(a).toEqual(b);
    expect(mockVerificar).toHaveBeenCalledTimes(1);
  });
});

describe('recuperar la contraseña con el link, en otro navegador', () => {
  test('antes de elegir, muestra de qué cuenta es; la app todavía no tiene la sesión', async () => {
    mockVerificar.mockResolvedValue({ data: sesionYUsuario('beto@correo.example'), error: null });
    await expect(abrirLinkDeMail(link('recovery'))).resolves.toEqual({ tipo: 'recuperacion' });
    expect(useRecuperacion.getState()).toMatchObject({
      activa: true,
      cuenta: 'b***@correo.example',
    });
    expect(app().setSession).not.toHaveBeenCalled();
    expect(delLink().signOut).not.toHaveBeenCalled();
  });

  test('"No es mi cuenta" cierra la sesión del link y la app sigue como estaba', async () => {
    mockVerificar.mockResolvedValue({ data: sesionYUsuario('ajena@example.com'), error: null });
    await abrirLinkDeMail(link('recovery'));
    const cliente = delLink();
    await cancelarRecuperacion();
    expect(cliente.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(cliente.updateUser).not.toHaveBeenCalled();
    expect(app().setSession).not.toHaveBeenCalled();
    // La sesión de la app (si había una, de otra cuenta) no se toca.
    expect(app().signOut).not.toHaveBeenCalled();
    expect(useRecuperacion.getState()).toMatchObject({ activa: false, cuenta: null });
  });

  test('con la contraseña nueva elegida, recién ahí la sesión pasa a la app', async () => {
    const sesion = sesionDe('beto@correo.example');
    mockVerificar.mockResolvedValue({ data: { session: sesion, user: sesion.user }, error: null });
    await abrirLinkDeMail(link('recovery'));
    const cliente = delLink();
    mockSesion = sesion;

    await expect(cambiarContrasena('clave-nueva-9', 'clave-nueva-9')).resolves.toEqual({
      conSesion: true,
    });
    expect(cliente.updateUser).toHaveBeenCalledWith({ password: 'clave-nueva-9' });
    expect(app().updateUser).not.toHaveBeenCalled();
    expect(app().setSession).toHaveBeenCalledWith({
      access_token: sesion.access_token,
      refresh_token: sesion.refresh_token,
    });
    expect(cliente.signOut).not.toHaveBeenCalled();
    expect(useRecuperacion.getState().activa).toBe(false);
  });

  test('el link viejo (?code=, en este navegador) también muestra la cuenta y deja cancelar', async () => {
    alCambiarLaSesion('PASSWORD_RECOVERY', sesionDe('eva@correo.example'));
    expect(useRecuperacion.getState()).toMatchObject({
      activa: true,
      cuenta: 'e***@correo.example',
    });
    await cancelarRecuperacion();
    expect(app().signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('qué se muestra después del link', () => {
  test('confirmada: ingresar, o al mapa si ya hay otra sesión abierta', () => {
    expect(pantallaDelLink({ tipo: 'cuentaConfirmada' }, false)).toEqual({
      mensaje: t.auth.confirmar.cuentaConfirmada,
      tipo: 'exito',
      boton: 'ingresar',
    });
    expect(pantallaDelLink({ tipo: 'cuentaConfirmada' }, true).boton).toBe('mapa');
    expect(pantallaDelLink({ tipo: 'emailCambiado' }, false).boton).toBe('ingresar');
    expect(pantallaDelLink({ tipo: 'faltaElOtroEmail' }, false)).toMatchObject({
      tipo: 'info',
      boton: 'mapa',
    });
  });

  test('vencido: pedir otro link de recuperación; la cuenta, ingresar o volver a crearla', () => {
    expect(pantallaDelLink({ tipo: 'vencido', link: 'recovery' }, false)).toEqual({
      mensaje: t.auth.nuevaContrasena.linkVencido,
      tipo: 'error',
      boton: 'recuperar',
    });
    expect(pantallaDelLink({ tipo: 'vencido', link: 'signup' }, false)).toMatchObject({
      mensaje: t.auth.confirmar.vencidoCuenta,
      boton: 'ingresar',
    });
    expect(pantallaDelLink({ tipo: 'vencido', link: 'email_change' }, false)).toMatchObject({
      mensaje: t.auth.confirmar.vencidoEmail,
      boton: 'mapa',
    });
  });
});

function sesionYUsuario(email: string) {
  const sesion = sesionDe(email);
  return { session: sesion, user: sesion.user };
}

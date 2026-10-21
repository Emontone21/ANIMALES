/**
 * Sesión fijada por link (auditoría 2, S-M1 y S-B5): con PKCE, solo un código
 * que esta app pidió abre sesión. Un link con tokens ajenos no.
 */
// El cliente falso se arma dentro del mock: los import se cargan antes que el
// resto del archivo.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
      setSession: jest.fn(),
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

import { crearSesionDesdeUrl } from '@/features/auth/acciones';
import { ErrorAuth } from '@/features/auth/validaciones';
import { codigoDeAuth, leerParametros, linkDeRecuperacionInvalido } from '@/lib/urlAuth';

const mockCreateClient = jest.requireMock('@supabase/supabase-js').createClient as jest.Mock;
const auth = mockCreateClient.mock.results[0]?.value.auth as Record<string, jest.Mock>;
const mockExchange = auth.exchangeCodeForSession;
const mockGetSession = auth.getSession;
const mockSetSession = auth.setSession;

beforeEach(() => {
  mockExchange.mockReset();
  mockGetSession.mockReset();
  mockSetSession.mockReset();
});

describe('cliente de Supabase', () => {
  test('usa el flujo PKCE', () => {
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    const opciones = (mockCreateClient.mock.calls[0] as unknown[])[2] as {
      auth: { flowType?: string };
    };
    expect(opciones.auth.flowType).toBe('pkce');
  });
});

describe('códigos y tokens en la URL', () => {
  test('el código sale de la query', () => {
    expect(codigoDeAuth(leerParametros('https://spot.test/?code=abc-123'))).toBe('abc-123');
    expect(codigoDeAuth(leerParametros('spotmvd://auth/callback?code=xyz'))).toBe('xyz');
  });

  test('los tokens sueltos no son un código', () => {
    const url = 'https://spot.test/animal/1#access_token=a&refresh_token=b&type=recovery';
    expect(codigoDeAuth(leerParametros(url))).toBeNull();
    expect(codigoDeAuth(leerParametros('https://spot.test/?code='))).toBeNull();
  });

  test('link de recuperación vencido, solo en la pantalla de la contraseña nueva', () => {
    expect(
      linkDeRecuperacionInvalido(
        'https://spot.test/auth/nueva-contrasena?error=access_denied&error_code=otp_expired',
      ),
    ).toBe(true);
    expect(
      linkDeRecuperacionInvalido(
        'https://spot.test/auth/nueva-contrasena#error=access_denied&error_code=otp_expired',
      ),
    ).toBe(true);
    expect(linkDeRecuperacionInvalido('https://spot.test/auth/nueva-contrasena?code=abc')).toBe(
      false,
    );
    expect(linkDeRecuperacionInvalido('https://spot.test/?error_code=otp_expired')).toBe(false);
    expect(linkDeRecuperacionInvalido('no es una url')).toBe(false);
  });
});

describe('crearSesionDesdeUrl (deep links en nativo)', () => {
  test('un link con tokens ajenos no abre sesión', async () => {
    await crearSesionDesdeUrl('spotmvd://auth/callback#access_token=a&refresh_token=b');
    await crearSesionDesdeUrl(
      'spotmvd://auth/nueva-contrasena#access_token=a&refresh_token=b&type=recovery',
    );
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchange).not.toHaveBeenCalled();
  });

  test('con un código, lo canjea', async () => {
    mockExchange.mockResolvedValue({ data: {}, error: null });
    await crearSesionDesdeUrl('spotmvd://auth/callback?code=abc');
    expect(mockExchange).toHaveBeenCalledWith('abc');
  });

  test('el mismo link dos veces: si ya hay sesión, no es un error', async () => {
    mockExchange.mockResolvedValue({
      data: {},
      error: { name: 'AuthPKCECodeVerifierMissingError', message: 'verifier missing', status: 400 },
    });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'x' } } });
    await expect(crearSesionDesdeUrl('spotmvd://auth/callback?code=abc')).resolves.toBeUndefined();
  });

  test('sin el verificador y sin sesión, un error en español', async () => {
    mockExchange.mockResolvedValue({
      data: {},
      error: { name: 'AuthPKCECodeVerifierMissingError', message: 'verifier missing', status: 400 },
    });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(crearSesionDesdeUrl('spotmvd://auth/callback?code=abc')).rejects.toBeInstanceOf(
      ErrorAuth,
    );
  });

  test('el error del link llega como ErrorAuth', async () => {
    await expect(
      crearSesionDesdeUrl('spotmvd://auth/callback?error=access_denied&error_code=otp_expired'),
    ).rejects.toBeInstanceOf(ErrorAuth);
  });
});

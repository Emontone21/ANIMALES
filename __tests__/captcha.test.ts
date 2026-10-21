import { claveCaptcha, CLAVE_CAPTCHA, opcionesCaptcha } from '@/features/auth/captcha';
import { ErrorAuth, traducirError } from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';

describe('captcha de Turnstile (B32)', () => {
  test('solo en web y con la clave del sitio', () => {
    expect(claveCaptcha('1x00000000000000000000AA', 'web')).toBe('1x00000000000000000000AA');
    expect(claveCaptcha(null, 'web')).toBeNull();
    expect(claveCaptcha('1x00000000000000000000AA', 'android')).toBeNull();
    expect(claveCaptcha('1x00000000000000000000AA', 'ios')).toBeNull();
  });

  test('sin la variable (como en estas pruebas), la app funciona como antes', () => {
    expect(CLAVE_CAPTCHA).toBeNull();
    expect(opcionesCaptcha(CLAVE_CAPTCHA, null)).toEqual({});
  });

  test('con captcha, el token va como captchaToken', () => {
    expect(opcionesCaptcha('clave', 'token-1')).toEqual({ captchaToken: 'token-1' });
  });

  test('con captcha y sin token, un error en español antes de mandar nada', () => {
    expect(() => opcionesCaptcha('clave', null)).toThrow(ErrorAuth);
    expect(() => opcionesCaptcha('clave', '')).toThrow(t.auth.captcha.falta);
  });

  test('si Supabase rechaza el captcha, lo dice en español', () => {
    expect(
      traducirError({
        code: 'captcha_failed',
        status: 400,
        message: 'captcha protection: request disallowed (no captcha_token found)',
      }).message,
    ).toBe(t.auth.errores.captcha);
  });
});

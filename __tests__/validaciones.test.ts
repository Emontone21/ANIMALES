import {
  ErrorAuth,
  nombrePublicoValido,
  traducirError,
  validarContrasenaNueva,
  validarEmail,
  validarRegistro,
} from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';
import { ErrorVisible, mensajeDeError } from '@/lib/errores';

const errores = t.auth.errores;

describe('crear una cuenta', () => {
  test('devuelve el nombre sin espacios', () => {
    expect(validarRegistro('  Ana  ', 'ana@ejemplo.uy', '12345678', true)).toBe('Ana');
  });

  test.each<[string, string, string, string, boolean, string]>([
    ['nombre corto', 'A', 'ana@ejemplo.uy', '12345678', true, errores.nombreCorto],
    ['email sin dominio', 'Ana', 'ana@ejemplo', '12345678', true, errores.emailInvalido],
    ['contraseña de 7', 'Ana', 'ana@ejemplo.uy', '1234567', true, errores.contrasenaCorta],
    ['sin aceptar los términos', 'Ana', 'ana@ejemplo.uy', '12345678', false, errores.debeAceptar],
  ])('%s', (_caso, nombre, email, contrasena, acepta, mensaje) => {
    expect(() => validarRegistro(nombre, email, contrasena, acepta)).toThrow(mensaje);
  });

  test('los errores de la app son ErrorAuth y se muestran tal cual', () => {
    let error: unknown;
    try {
      validarEmail('no es un email');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorAuth);
    expect(error).toBeInstanceOf(ErrorVisible);
    expect(mensajeDeError(error)).toBe(errores.emailInvalido);
  });
});

test('contraseña nueva: largo y que coincidan', () => {
  expect(() => validarContrasenaNueva('1234567', '1234567')).toThrow(errores.contrasenaCorta);
  expect(() => validarContrasenaNueva('12345678', '12345679')).toThrow(
    t.auth.nuevaContrasena.noCoinciden,
  );
  expect(() => validarContrasenaNueva('12345678', '12345678')).not.toThrow();
});

test('nombre público: de 2 a 40 caracteres, sin contar los espacios de los costados', () => {
  expect(nombrePublicoValido(' A ')).toBe(false);
  expect(nombrePublicoValido('Ana')).toBe(true);
  expect(nombrePublicoValido('x'.repeat(40))).toBe(true);
  expect(nombrePublicoValido('x'.repeat(41))).toBe(false);
});

describe('errores de Supabase Auth en español', () => {
  test.each([
    [{ message: 'Invalid login credentials', code: 'invalid_credentials' }, errores.credenciales],
    [{ message: 'Email not confirmed' }, errores.emailNoConfirmado],
    [{ message: 'User already registered', code: 'user_already_exists' }, errores.yaRegistrado],
    [
      { message: 'Password should be at least 8 characters', code: 'weak_password' },
      errores.contrasenaCorta,
    ],
    // Sin SMTP propio Supabase manda pocos mails por hora: antes decía "email inválido".
    [
      { message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 },
      errores.muchosIntentos,
    ],
    [
      { message: 'Request rate limit reached', code: 'over_request_rate_limit' },
      errores.muchosIntentos,
    ],
    [{ message: 'Failed to fetch' }, t.comunes.sinConexion],
    [{ message: 'Something else' }, errores.desconocido],
  ])('%j', (error, esperado) => {
    expect(traducirError(error).message).toBe(esperado);
  });
});

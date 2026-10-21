import { t } from '@/i18n/es-UY';
import { ErrorVisible, esErrorDeRed } from '@/lib/errores';

/**
 * Validaciones de los formularios de cuenta y traducción de los errores de
 * Supabase Auth. Sin React ni Supabase: las pruebas las usan directo.
 */

export class ErrorAuth extends ErrorVisible {}

export const MIN_CONTRASENA = 8;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Igual que perfiles.nombre_publico en la base (2 a 40). */
export const LARGO_NOMBRE_PUBLICO = { minimo: 2, maximo: 40 } as const;

/** El nombre público, sin espacios a los costados, tiene entre 2 y 40 caracteres. */
export function nombrePublicoValido(nombre: string): boolean {
  const largo = nombre.trim().length;
  return largo >= LARGO_NOMBRE_PUBLICO.minimo && largo <= LARGO_NOMBRE_PUBLICO.maximo;
}

/**
 * Traduce los errores más comunes de Supabase Auth a mensajes en español.
 * Los límites van primero: "email rate limit exceeded" dice "email" y, sin
 * SMTP propio, Supabase manda pocos mails por hora (registrarse los usa).
 */
export function traducirError(error: {
  message: string;
  code?: string;
  status?: number;
}): ErrorAuth {
  const codigo = error.code ?? '';
  const mensaje = error.message.toLowerCase();

  if (esErrorDeRed(error)) return new ErrorAuth(t.comunes.sinConexion);
  if (
    error.status === 429 ||
    codigo.startsWith('over_') ||
    mensaje.includes('rate limit') ||
    mensaje.includes('too many')
  ) {
    return new ErrorAuth(t.auth.errores.muchosIntentos);
  }
  if (codigo === 'captcha_failed' || mensaje.includes('captcha')) {
    return new ErrorAuth(t.auth.errores.captcha);
  }
  if (codigo === 'invalid_credentials' || mensaje.includes('invalid login credentials')) {
    return new ErrorAuth(t.auth.errores.credenciales);
  }
  if (codigo === 'email_not_confirmed' || mensaje.includes('email not confirmed')) {
    return new ErrorAuth(t.auth.errores.emailNoConfirmado);
  }
  if (codigo === 'user_already_exists' || mensaje.includes('already registered')) {
    return new ErrorAuth(t.auth.errores.yaRegistrado);
  }
  if (codigo === 'same_password' || mensaje.includes('different from the old')) {
    return new ErrorAuth(t.auth.nuevaContrasena.igualAnterior);
  }
  if (codigo === 'weak_password' || mensaje.includes('password')) {
    return new ErrorAuth(t.auth.errores.contrasenaCorta);
  }
  if (codigo === 'validation_failed' || mensaje.includes('email')) {
    return new ErrorAuth(t.auth.errores.emailInvalido);
  }
  return new ErrorAuth(t.auth.errores.desconocido);
}

export function validarEmail(email: string): void {
  if (!EMAIL_VALIDO.test(email.trim())) throw new ErrorAuth(t.auth.errores.emailInvalido);
}

export function validarEmailYContrasena(email: string, contrasena: string): void {
  validarEmail(email);
  if (contrasena.length < MIN_CONTRASENA) throw new ErrorAuth(t.auth.errores.contrasenaCorta);
}

/** Crear una cuenta: nombre público, email, contraseña y la casilla. Devuelve el nombre limpio. */
export function validarRegistro(
  nombrePublico: string,
  email: string,
  contrasena: string,
  aceptoTerminos: boolean,
): string {
  const nombre = nombrePublico.trim();
  if (nombre.length < LARGO_NOMBRE_PUBLICO.minimo) throw new ErrorAuth(t.auth.errores.nombreCorto);
  validarEmailYContrasena(email, contrasena);
  if (!aceptoTerminos) throw new ErrorAuth(t.auth.errores.debeAceptar);
  return nombre;
}

/** Elegir una contraseña nueva (recuperación): largo mínimo y las dos iguales. */
export function validarContrasenaNueva(nueva: string, repetida: string): void {
  if (nueva.length < MIN_CONTRASENA) throw new ErrorAuth(t.auth.errores.contrasenaCorta);
  if (nueva !== repetida) throw new ErrorAuth(t.auth.nuevaContrasena.noCoinciden);
}

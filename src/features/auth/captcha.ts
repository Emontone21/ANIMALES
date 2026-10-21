import { Platform } from 'react-native';

import { ErrorAuth } from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';

/**
 * Captcha de Cloudflare Turnstile al registrarse, ingresar con email y recuperar
 * la contraseña (Supabase Auth la exige en esos pedidos cuando está activada).
 * Ingresar con Google no la lleva.
 *
 * Solo en web: la app nativa todavía no tiene el widget. Sin la clave del sitio
 * (EXPO_PUBLIC_TURNSTILE_SITE_KEY), la app funciona como antes, sin captcha.
 */
export function claveCaptcha(clave: string | null, plataforma: string): string | null {
  return plataforma === 'web' && clave ? clave : null;
}

export const CLAVE_CAPTCHA = claveCaptcha(ENV.turnstileSiteKey, Platform.OS);

/**
 * Las opciones que van a Supabase Auth: el token, si hay captcha. Con captcha y
 * sin token (la comprobación no terminó o venció), un error en español.
 */
export function opcionesCaptcha(
  clave: string | null,
  token: string | null | undefined,
): { captchaToken?: string } {
  if (!clave) return {};
  if (!token) throw new ErrorAuth(t.auth.captcha.falta);
  return { captchaToken: token };
}

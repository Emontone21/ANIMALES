/**
 * Captcha de registrarse, ingresar y recuperar la contraseña. En nativo no hay
 * widget todavía: no muestra nada (ver src/features/auth/captcha.ts y la
 * versión web, Captcha.web.tsx).
 */
export type PropsCaptcha = {
  /** El token nuevo, o null cuando vence, falla o se reinicia. */
  alCambiar: (token: string | null) => void;
  /** Cambiarlo pide un token nuevo: cada token sirve para un solo intento. */
  reinicio: number;
};

export function Captcha(_props: PropsCaptcha) {
  return null;
}

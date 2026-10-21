import { useState } from 'react';

/**
 * El token de Turnstile de una pantalla (con captcha, ver captcha.ts) y cómo
 * pedir otro: cada token sirve para un solo intento, salga bien o mal.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  return {
    token,
    /** Después de cada intento. */
    reiniciar: () => setReinicio((n) => n + 1),
    /** Para el componente Captcha. */
    props: { alCambiar: setToken, reinicio },
  };
}

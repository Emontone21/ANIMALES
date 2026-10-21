import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { PropsCaptcha } from '@/components/auth/Captcha';
import { Mensaje } from '@/components/ui/Mensaje';
import { CLAVE_CAPTCHA } from '@/features/auth/captcha';
import { useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

export type { PropsCaptcha } from '@/components/auth/Captcha';

/** Lo que usamos de la API de Turnstile (render explícito). */
type Turnstile = {
  render: (
    contenedor: HTMLElement,
    opciones: {
      sitekey: string;
      theme: 'light' | 'dark';
      language: string;
      size: 'flexible';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** El alto del widget de Turnstile: así no salta la pantalla cuando aparece. */
const ALTO = 65;

let carga: Promise<Turnstile> | null = null;

/** El script se baja solo cuando una pantalla muestra el captcha, una vez. */
function cargarTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  carga ??= new Promise<Turnstile>((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolver(window.turnstile) : rechazar(new Error('turnstile'));
    script.onerror = () => {
      carga = null;
      script.remove();
      rechazar(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return carga;
}

/**
 * Cloudflare Turnstile (modo administrado: casi siempre se resuelve solo; a veces
 * pide tocar una casilla). En el idioma y el esquema de la app.
 */
export function Captcha({ alCambiar, reinicio }: PropsCaptcha) {
  const { esquema } = useTema();
  const contenedor = useRef<ComponentRef<typeof View>>(null);
  const widget = useRef<string | null>(null);
  // La función más nueva, para los callbacks de Turnstile, sin volver a dibujar el widget.
  const avisar = useRef(alCambiar);
  useEffect(() => {
    avisar.current = alCambiar;
  });
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!CLAVE_CAPTCHA) return;
    let vigente = true;
    cargarTurnstile()
      .then((turnstile) => {
        // En web, la referencia de un View es su elemento del DOM.
        const elemento = contenedor.current as unknown as HTMLElement | null;
        if (!vigente || !elemento || !CLAVE_CAPTCHA) return;
        widget.current = turnstile.render(elemento, {
          sitekey: CLAVE_CAPTCHA,
          theme: esquema === 'oscuro' ? 'dark' : 'light',
          language: 'es',
          size: 'flexible',
          callback: (token) => {
            setError(false);
            avisar.current(token);
          },
          'expired-callback': () => avisar.current(null),
          'error-callback': () => {
            avisar.current(null);
            setError(true);
          },
        });
      })
      .catch(() => {
        if (vigente) setError(true);
      });
    return () => {
      vigente = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      avisar.current(null);
    };
  }, [esquema, intento]);

  // Cada intento de ingresar gasta el token: después se pide otro.
  useEffect(() => {
    if (reinicio === 0 || !widget.current) return;
    window.turnstile?.reset(widget.current);
    avisar.current(null);
  }, [reinicio]);

  if (!CLAVE_CAPTCHA) return null;
  return (
    <View>
      <View ref={contenedor} style={{ minHeight: ALTO }} />
      {error ? (
        <Mensaje
          texto={t.auth.captcha.error}
          tipo="error"
          onReintentar={() => {
            setError(false);
            setIntento((n) => n + 1);
          }}
        />
      ) : null}
    </View>
  );
}

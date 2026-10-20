import { useSyncExternalStore } from 'react';

import {
  appConNavegador,
  formaDeInstalar,
  type FormaDeInstalar,
} from '@/features/instalar/formaDeInstalar';

/** El aviso de Chrome y Edge para instalar (no está en los tipos de TypeScript). */
type AvisoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Lo guarda el script de public/index.html, antes de que monte la app. */
type EstadoInstalar = { aviso: AvisoInstalar | null; instalada: boolean };

declare global {
  interface Window {
    __instalar?: EstadoInstalar;
  }
}

const CAMBIO = 'instalar-cambio';
const COMO_APP = '(display-mode: standalone)';

function estado(): EstadoInstalar {
  return (window.__instalar ??= { aviso: null, instalada: false });
}

function suscribir(aviso: () => void) {
  const comoApp = window.matchMedia(COMO_APP);
  window.addEventListener(CAMBIO, aviso);
  comoApp.addEventListener('change', aviso);
  return () => {
    window.removeEventListener(CAMBIO, aviso);
    comoApp.removeEventListener('change', aviso);
  };
}

function forma(): FormaDeInstalar {
  const { aviso, instalada } = estado();
  return formaDeInstalar({
    plataforma: 'web',
    userAgent: navigator.userAgent,
    puntosDeToque: navigator.maxTouchPoints ?? 0,
    abiertaComoApp:
      window.matchMedia(COMO_APP).matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    recienInstalada: instalada,
    hayAviso: aviso !== null,
  });
}

/** Abre la ventana de Chrome o Edge. El aviso se usa una sola vez. */
async function instalar(): Promise<void> {
  const actual = estado();
  const aviso = actual.aviso;
  if (!aviso) return;
  actual.aviso = null;
  await aviso.prompt();
  const { outcome } = await aviso.userChoice;
  if (outcome === 'accepted') actual.instalada = true;
  window.dispatchEvent(new Event(CAMBIO));
}

/** Web: qué ofrecer en "Instalar la app" (cambia si Chrome avisa o si se instala). */
export function useInstalar() {
  return {
    forma: useSyncExternalStore(suscribir, forma, () => 'ninguna' as const),
    app: appConNavegador(navigator.userAgent),
    instalar,
  };
}

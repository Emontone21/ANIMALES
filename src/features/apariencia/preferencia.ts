import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Perfil › Apariencia. Se guarda en el dispositivo y funciona sin cuenta. */
export type PreferenciaApariencia = 'automatico' | 'claro' | 'oscuro';

export const PREFERENCIAS_APARIENCIA: PreferenciaApariencia[] = ['automatico', 'claro', 'oscuro'];

/**
 * Clave en AsyncStorage (localStorage en web). public/index.html la lee antes
 * de cargar la app para que el primer pintado ya siga la preferencia.
 */
export const CLAVE_APARIENCIA = 'encontrados-apariencia';

type EstadoApariencia = {
  preferencia: PreferenciaApariencia;
  setPreferencia: (preferencia: PreferenciaApariencia) => void;
};

export const usePreferenciaApariencia = create<EstadoApariencia>()(
  persist(
    (set) => ({
      preferencia: 'automatico',
      setPreferencia: (preferencia) => set({ preferencia }),
    }),
    {
      name: CLAVE_APARIENCIA,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ preferencia }) => ({ preferencia }),
    },
  ),
);

const suscribirHidratacion = (aviso: () => void) =>
  usePreferenciaApariencia.persist.onFinishHydration(aviso);
const estaHidratada = () => usePreferenciaApariencia.persist.hasHydrated();

/** true cuando ya se leyó la preferencia guardada (para no mostrar el tema equivocado). */
export function useAparienciaHidratada(): boolean {
  return useSyncExternalStore(suscribirHidratacion, estaHidratada, estaHidratada);
}

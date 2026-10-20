import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Si la hoja "Cerca tuyo" del celular quedó plegada. Se guarda en el
 * dispositivo, como la apariencia (src/features/apariencia/preferencia.ts), y
 * funciona sin cuenta.
 */
export const CLAVE_HOJA = 'encontrados-hoja-cerca';

type EstadoHoja = {
  plegada: boolean;
  setPlegada: (plegada: boolean) => void;
};

export const usePreferenciaHoja = create<EstadoHoja>()(
  persist(
    (set) => ({
      plegada: false,
      setPlegada: (plegada) => set({ plegada }),
    }),
    {
      name: CLAVE_HOJA,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ plegada }) => ({ plegada }),
    },
  ),
);

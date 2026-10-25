import { Urbanist_500Medium } from '@expo-google-fonts/urbanist/500Medium';
import { Urbanist_600SemiBold } from '@expo-google-fonts/urbanist/600SemiBold';
import { Urbanist_700Bold } from '@expo-google-fonts/urbanist/700Bold';
import { useFonts } from 'expo-font';

import { FAMILIAS } from '@/constants/tema';

/**
 * Los archivos de cada familia de FAMILIAS. `titulo` y `negrita` son el mismo
 * (Urbanist Bold): una sola entrada.
 */
export const ARCHIVOS_DE_FUENTES = {
  [FAMILIAS.regular]: Urbanist_500Medium,
  [FAMILIAS.seminegrita]: Urbanist_600SemiBold,
  [FAMILIAS.negrita]: Urbanist_700Bold,
};

/**
 * Si la app ya puede mostrarse. En nativo espera a que carguen las fuentes
 * (con la pantalla de carga de expo-splash-screen); si fallan, se sigue con la
 * del sistema. En web no espera: ver useFuentes.web.ts.
 */
export function useFuentes(): boolean {
  const [listas, error] = useFonts(ARCHIVOS_DE_FUENTES);
  return listas || error != null;
}

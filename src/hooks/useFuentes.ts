import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { useFonts } from 'expo-font';

import { FAMILIAS } from '@/constants/tema';

/**
 * Si la app ya puede mostrarse. En nativo espera a que carguen las fuentes
 * (con la pantalla de carga de expo-splash-screen); si fallan, se sigue con la
 * del sistema. En web no espera: ver useFuentes.web.ts.
 */
export function useFuentes(): boolean {
  const [listas, error] = useFonts({
    [FAMILIAS.titulo]: Fredoka_600SemiBold,
    [FAMILIAS.regular]: Figtree_400Regular,
    [FAMILIAS.seminegrita]: Figtree_600SemiBold,
    [FAMILIAS.negrita]: Figtree_700Bold,
  });
  return listas || error != null;
}

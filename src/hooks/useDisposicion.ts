import { useWindowDimensions } from 'react-native';

/** compacto: celulares · medio: tablets y ventanas angostas · amplio: computadoras. */
export type Disposicion = 'compacto' | 'medio' | 'amplio';

export const CORTE_MEDIO = 600;
export const CORTE_AMPLIO = 1024;

export function disposicionPara(ancho: number): Disposicion {
  if (ancho >= CORTE_AMPLIO) return 'amplio';
  if (ancho >= CORTE_MEDIO) return 'medio';
  return 'compacto';
}

/** Disposición según el ancho de la ventana (docs/DISENO.md, sección 8). */
export function useDisposicion(): Disposicion {
  const { width } = useWindowDimensions();
  return disposicionPara(width);
}

import type { PressableStateCallbackType } from 'react-native';

/**
 * En web, react-native-web también pasa `hovered` y `focused` al estilo de
 * Pressable, aunque los tipos de React Native solo declaran `pressed`.
 */
export type EstadoInteraccion = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

/** Presionado o con el mouse encima: los dos se ven igual (docs/DISENO.md, 6.1). */
export function estaActivo(estado: PressableStateCallbackType): boolean {
  const { pressed, hovered } = estado as EstadoInteraccion;
  return pressed || hovered === true;
}

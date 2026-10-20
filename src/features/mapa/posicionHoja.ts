/**
 * Hoja "Cerca tuyo" del celular (docs/DISENO.md, 6.7): dos posiciones,
 * abierta (con el carrusel) y plegada (solo la barra). La hoja se dibuja
 * siempre con el alto de abierta y, plegada, baja `recorrido` píxeles. Reglas
 * puras, sin React: las prueba __tests__/posicionHoja.test.ts.
 */

/** Píxeles que tiene que moverse el dedo, en vertical, para que cuente como arrastre. */
export const UMBRAL_ARRASTRE = 6;

/** Más rápido que esto (píxeles por milisegundo) manda la dirección del gesto, no la posición. */
export const VELOCIDAD_PARA_SOLTAR = 0.5;

/** Cuánto baja la hoja en cada posición: 0 abierta, `recorrido` plegada. */
export function desplazamientoHoja(plegada: boolean, recorrido: number): number {
  return plegada ? Math.max(0, recorrido) : 0;
}

/** Mientras se arrastra: sigue al dedo sin pasarse de las dos posiciones. */
export function desplazamientoAlArrastrar(
  plegadaAlEmpezar: boolean,
  dy: number,
  recorrido: number,
): number {
  const desde = desplazamientoHoja(plegadaAlEmpezar, recorrido);
  return Math.min(Math.max(desde + dy, 0), Math.max(0, recorrido));
}

/**
 * Al soltar: si el gesto fue rápido, va hacia donde iba el dedo (abajo pliega,
 * arriba despliega); si fue lento, a la posición más cercana.
 */
export function plegadaAlSoltar({
  plegadaAlEmpezar,
  dy,
  vy,
  recorrido,
}: {
  plegadaAlEmpezar: boolean;
  dy: number;
  vy: number;
  recorrido: number;
}): boolean {
  if (recorrido <= 0) return plegadaAlEmpezar;
  if (Math.abs(vy) >= VELOCIDAD_PARA_SOLTAR) return vy > 0;
  return desplazamientoAlArrastrar(plegadaAlEmpezar, dy, recorrido) > recorrido / 2;
}

/** Si el movimiento es un arrastre vertical de la hoja (y no un toque ni un desliz al costado). */
export function esArrastreVertical(dx: number, dy: number): boolean {
  return Math.abs(dy) > UMBRAL_ARRASTRE && Math.abs(dy) > Math.abs(dx);
}

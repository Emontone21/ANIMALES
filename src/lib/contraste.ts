/**
 * Contraste entre dos colores de la paleta (#RRGGBB), según WCAG 2.
 * Lo usa el mapa en grande para elegir el color del número de cada punto.
 */

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => {
    const valor = parseInt(hex.slice(i, i + 2), 16) / 255;
    return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

export function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

/** De las opciones, la que más se lee sobre ese fondo. */
export function masLegible(fondo: string, opciones: string[]): string {
  return opciones.reduce((mejor, opcion) =>
    contraste(fondo, opcion) > contraste(fondo, mejor) ? opcion : mejor,
  );
}

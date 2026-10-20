/**
 * Las últimas pantallas visitadas, para "Reportar un error": el formulario se
 * abre desde Perfil y lo que sirve es la pantalla anterior, donde pasó el
 * error. Solo en memoria; lo anota _layout cada vez que cambia la ruta.
 */
const LIMITE = 10;
const rutas: string[] = [];

export function anotarRuta(ruta: string): void {
  if (rutas[rutas.length - 1] === ruta) return;
  rutas.push(ruta);
  if (rutas.length > LIMITE) rutas.shift();
}

/** La última pantalla distinta de `actual` (por defecto, Perfil), o null si se entró por ahí. */
export function pantallaAnterior(actual = '/perfil'): string | null {
  for (let i = rutas.length - 1; i >= 0; i--) {
    if (rutas[i] !== actual) return rutas[i] ?? null;
  }
  return null;
}

/** Solo para las pruebas. */
export function olvidarRutas(): void {
  rutas.length = 0;
}

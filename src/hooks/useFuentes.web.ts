/**
 * En web la app no espera a las fuentes. public/index.html las declara con
 * @font-face y font-display: swap (las copia scripts/copiar-a-public.js): se ve
 * enseguida con la fuente del sistema (la pila de Fuentes en tema.ts) y cambia
 * sola cuando llegan. expo-font, en cambio, dejaba la pantalla vacía hasta que
 * bajaban (o hasta 12 s) y en web pedía cada fuente dos veces.
 */
export function useFuentes(): boolean {
  return true;
}

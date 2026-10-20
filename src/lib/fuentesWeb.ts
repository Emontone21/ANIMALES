/**
 * Solo web: activa las @font-face de public/index.html (Fredoka y Figtree).
 * Arrancan apagadas para que sus 170 KB no compitan con el JS ni con las fotos
 * que se ven al abrir; hasta que llegan, el texto usa la fuente del sistema.
 * Las activa useCargarMapa (después de las fotos prioritarias) o, en las
 * pantallas sin mapa, _layout con un plazo.
 */
export function activarFuentesWeb(): void {
  if (typeof document === 'undefined') return;
  document.getElementById('encontrados-fuentes')?.setAttribute('media', 'all');
}

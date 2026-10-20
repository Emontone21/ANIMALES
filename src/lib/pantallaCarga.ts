/** Si la app no dibuja nada en este tiempo, la pantalla de carga se va igual. */
const PLAZO_MS = 8000;

/**
 * Solo web: saca la pantalla de carga de public/index.html (#carga) cuando la
 * app dibuja su primera pantalla con contenido, no apenas monta el marco: las
 * pantallas llegan en bloques aparte y, mientras tanto, quedaría el fondo vacío.
 */
export function ocultarPantallaCarga(): void {
  if (typeof document === 'undefined') return;
  const carga = document.getElementById('carga');
  const raiz = document.getElementById('root');
  if (!carga) return;
  const conContenido = () => !raiz || (raiz.textContent ?? '').trim() !== '';
  if (conContenido()) {
    carga.remove();
    return;
  }
  const terminar = () => {
    observador.disconnect();
    clearTimeout(plazo);
    carga.remove();
  };
  const observador = new MutationObserver(() => {
    if (conContenido()) terminar();
  });
  const plazo = setTimeout(terminar, PLAZO_MS);
  observador.observe(raiz as HTMLElement, { childList: true, subtree: true, characterData: true });
}

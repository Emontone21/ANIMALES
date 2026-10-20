/**
 * Solo web: empieza a bajar una imagen con prioridad alta, antes de que la
 * pantalla la dibuje. El <img> que la muestre después usa la misma descarga.
 */
export function precargarImagen(url: string): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`)) return;
  const enlace = document.createElement('link');
  enlace.rel = 'preload';
  enlace.as = 'image';
  enlace.href = url;
  enlace.fetchPriority = 'high';
  document.head.appendChild(enlace);
}

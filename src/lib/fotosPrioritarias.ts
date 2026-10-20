/**
 * Cuántas fotos prioritarias (las que se ven al abrir: las primeras de "Cerca
 * tuyo", la foto del caso) siguen bajando. El mapa web espera a que terminen
 * para no quitarles ancho de banda ni procesador (useCargarMapa).
 */
let pendientes = 0;
const oyentes = new Set<() => void>();

/** Anota una foto que empezó a bajar. Devuelve cómo avisar que terminó (cargó o falló). */
export function empezoFotoPrioritaria(): () => void {
  pendientes += 1;
  let terminada = false;
  return () => {
    if (terminada) return;
    terminada = true;
    pendientes -= 1;
    if (pendientes === 0) for (const oyente of [...oyentes]) oyente();
  };
}

/** Llama a fn cuando no queda ninguna bajando (enseguida, si ya no hay). Devuelve cómo cancelarlo. */
export function cuandoTerminenLasPrioritarias(fn: () => void): () => void {
  if (pendientes === 0) {
    fn();
    return () => {};
  }
  const oyente = () => {
    oyentes.delete(oyente);
    fn();
  };
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

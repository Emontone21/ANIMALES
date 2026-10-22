/**
 * Atrás cierra la hoja abierta. En Android ya lo hace Modal (onRequestClose)
 * y en iOS no hay Atrás: solo la web suma una entrada al historial
 * (useCerrarConAtras.web.ts).
 */
export function useCerrarConAtras(_visible: boolean, _onCerrar: () => void) {}

/** Cierra una hoja y después navega (en web espera al historial). */
export function cerrarYNavegar(cerrar: () => void, navegar: () => void) {
  cerrar();
  navegar();
}

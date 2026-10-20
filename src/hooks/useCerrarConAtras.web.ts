import { useEffect, useRef } from 'react';

import { crearHistorialDeHojas, type HistorialDeHojas } from '@/lib/historialHojas';

let historial: HistorialDeHojas | null = null;

function historialDelNavegador() {
  historial ??= crearHistorialDeHojas({
    history: window.history,
    location: window.location,
    alVolver: (escucha) => window.addEventListener('popstate', escucha, { capture: true }),
    esperar: (fn, ms) => {
      const id = window.setTimeout(fn, ms);
      return () => window.clearTimeout(id);
    },
  });
  return historial;
}

/**
 * Atrás del navegador cierra la hoja abierta (Hoja, MenuOpciones,
 * SelectorUbicacion): mientras está visible tiene su entrada en el historial.
 * Detalle en src/lib/historialHojas.ts.
 */
export function useCerrarConAtras(visible: boolean, onCerrar: () => void) {
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  });

  useEffect(() => {
    if (!visible) return;
    const hojas = historialDelNavegador();
    const token = hojas.abrir(() => cerrar.current());
    return () => hojas.cerrar(token);
  }, [visible]);
}

import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

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

/**
 * Cierra una hoja y después navega. Si se navega mientras la hoja quita su
 * entrada del historial, Expo Router 58 cambia la URL pero se queda en la
 * pantalla de antes. flushSync cierra la hoja ya (su efecto empieza a quitar
 * la entrada) y la navegación espera a que termine.
 */
export function cerrarYNavegar(cerrar: () => void, navegar: () => void) {
  flushSync(cerrar);
  if (historial) historial.cuandoTermine(navegar);
  else navegar();
}

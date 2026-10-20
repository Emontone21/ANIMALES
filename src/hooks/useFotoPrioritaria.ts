import { useCallback, useEffect, useRef } from 'react';

import { empezoFotoPrioritaria } from '@/lib/fotosPrioritarias';

/**
 * Anota una foto prioritaria mientras baja (src/lib/fotosPrioritarias.ts).
 * Devuelve qué llamar cuando cargó o falló; al desmontar o cambiar de foto
 * también se da por terminada.
 */
export function useFotoPrioritaria(activa: boolean, foto: string): () => void {
  const terminar = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!activa) return;
    const fin = empezoFotoPrioritaria();
    terminar.current = fin;
    return fin;
  }, [activa, foto]);
  return useCallback(() => terminar.current?.(), []);
}

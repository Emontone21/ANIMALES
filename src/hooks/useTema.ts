import { StyleSheet, useColorScheme } from 'react-native';

import { type Esquema, type Paleta, paletas } from '@/constants/tema';
import {
  type PreferenciaApariencia,
  usePreferenciaApariencia,
} from '@/features/apariencia/preferencia';

export type Tema = {
  /** Paleta activa. */
  c: Paleta;
  esquema: Esquema;
  preferencia: PreferenciaApariencia;
  setPreferencia: (preferencia: PreferenciaApariencia) => void;
};

/** Combina la preferencia guardada con el esquema del sistema. */
export function useTema(): Tema {
  const preferencia = usePreferenciaApariencia((s) => s.preferencia);
  const setPreferencia = usePreferenciaApariencia((s) => s.setPreferencia);
  const sistema = useColorScheme();
  const esquema: Esquema =
    preferencia === 'automatico' ? (sistema === 'dark' ? 'oscuro' : 'claro') : preferencia;
  return { c: paletas[esquema], esquema, preferencia, setPreferencia };
}

/** Lo que acepta StyleSheet.create. */
type Estilos = Parameters<typeof StyleSheet.create>[0];

/**
 * Define los estilos de un componente en función de la paleta. Se crean una
 * sola vez por esquema y quedan memorizados:
 *
 *   const crear = crearEstilos((c) => ({ caja: { backgroundColor: c.superficie } }));
 *   const estilos = useEstilos(crear);
 */
export function crearEstilos<S extends Estilos>(
  fabrica: (c: Paleta, esquema: Esquema) => S,
): (esquema: Esquema) => Readonly<S> {
  const memoria: Partial<Record<Esquema, Readonly<S>>> = {};
  return (esquema) => (memoria[esquema] ??= StyleSheet.create(fabrica(paletas[esquema], esquema)));
}

export function useEstilos<T>(crear: (esquema: Esquema) => T): T {
  const { esquema } = useTema();
  return crear(esquema);
}

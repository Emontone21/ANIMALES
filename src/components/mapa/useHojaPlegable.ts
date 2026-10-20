import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type GestureResponderHandlers,
  PanResponder,
  Platform,
} from 'react-native';

import {
  desplazamientoAlArrastrar,
  desplazamientoHoja,
  esArrastreVertical,
  plegadaAlSoltar,
} from '@/features/mapa/posicionHoja';
import { usePreferenciaHoja } from '@/features/mapa/preferenciaHoja';

const DURACION_MS = 220;

export type HojaPlegable = {
  plegada: boolean;
  setPlegada: (plegada: boolean) => void;
  /** Cuánto baja la hoja (translateY): lo usa también el botón de mi ubicación. */
  desplazamiento: Animated.Value;
  /** Mientras se arrastra o se mueve: el carrusel se dibuja aunque vaya a quedar plegada. */
  moviendose: boolean;
  /** Para la barra de la hoja (manija, título y cantidad). */
  arrastre: GestureResponderHandlers;
};

/**
 * La hoja "Cerca tuyo" del celular, plegable (docs/DISENO.md, 6.7). Se arrastra
 * desde la barra o se toca; la posición se guarda en el dispositivo.
 * `recorrido`: lo que baja al plegarse (alto abierta menos alto plegada); con 0
 * (sin casos) no hay nada que plegar.
 * Usa PanResponder y Animated de React Native, que ya están en la carga inicial.
 */
export function useHojaPlegable(recorrido: number): HojaPlegable {
  const { plegada, setPlegada } = usePreferenciaHoja();
  const [moviendose, setMoviendose] = useState(false);
  const [control] = useState(() => crearControl(plegada, recorrido, setMoviendose));

  // Lo último, para el arrastre (el PanResponder se crea una sola vez).
  useEffect(() => control.actualizar(recorrido, setPlegada));

  // Con "reducir movimiento" la hoja cambia de posición sin animarse.
  useEffect(() => {
    let activo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reducir) => {
        if (activo) control.reducirMovimiento(reducir);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [control]);

  // Cambió la posición (arrastre, toque, teclado, un marcador) o el alto.
  useEffect(() => control.ir(plegada, recorrido), [control, plegada, recorrido]);

  return {
    plegada,
    setPlegada,
    desplazamiento: control.desplazamiento,
    moviendose,
    arrastre: control.arrastre,
  };
}

/**
 * Lo que no es de React: la posición animada, el PanResponder y lo último que
 * se sabe de la hoja (lo leen los gestos, no el dibujo).
 */
function crearControl(
  plegadaInicial: boolean,
  recorridoInicial: number,
  setMoviendose: (moviendose: boolean) => void,
) {
  const desplazamiento = new Animated.Value(desplazamientoHoja(plegadaInicial, recorridoInicial));
  let plegada = plegadaInicial;
  let recorrido = recorridoInicial;
  let destino = desplazamientoHoja(plegadaInicial, recorridoInicial);
  let plegadaAlEmpezar = plegadaInicial;
  let sinMovimiento = false;
  let setPlegada: (plegada: boolean) => void = () => {};

  /** Lleva la hoja a `destino`, animada. */
  const animar = () => {
    setMoviendose(true);
    Animated.timing(desplazamiento, {
      toValue: destino,
      duration: sinMovimiento ? 0 : DURACION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) setMoviendose(false);
    });
  };

  const { panHandlers: arrastre } = PanResponder.create({
    // Solo un movimiento vertical: un toque queda para el botón y un desliz
    // al costado, para el botón "Ver lista".
    onMoveShouldSetPanResponderCapture: (_, g) => recorrido > 0 && esArrastreVertical(g.dx, g.dy),
    onPanResponderGrant: () => {
      desplazamiento.stopAnimation();
      plegadaAlEmpezar = plegada;
      setMoviendose(true);
    },
    onPanResponderMove: (_, g) => {
      desplazamiento.setValue(desplazamientoAlArrastrar(plegadaAlEmpezar, g.dy, recorrido));
    },
    onPanResponderRelease: (_, g) => {
      const nueva = plegadaAlSoltar({ plegadaAlEmpezar, dy: g.dy, vy: g.vy, recorrido });
      // Si queda donde estaba, ir() no cambia nada: vuelve a su lugar desde acá.
      if (nueva === plegada) animar();
      else setPlegada(nueva);
    },
    onPanResponderTerminate: animar,
    // Un arrastre de la hoja ya empezado no se lo queda otro.
    onPanResponderTerminationRequest: () => false,
  });

  return {
    desplazamiento,
    arrastre,
    actualizar(nuevoRecorrido: number, nuevoSetPlegada: (plegada: boolean) => void) {
      recorrido = nuevoRecorrido;
      setPlegada = nuevoSetPlegada;
    },
    reducirMovimiento(reducir: boolean) {
      sinMovimiento = reducir;
    },
    /** La posición nueva se anima; un alto nuevo (otra pantalla, casos que llegan), no. */
    ir(nuevaPlegada: boolean, nuevoRecorrido: number) {
      const cambioDePosicion = nuevaPlegada !== plegada;
      plegada = nuevaPlegada;
      recorrido = nuevoRecorrido;
      const nuevoDestino = desplazamientoHoja(nuevaPlegada, nuevoRecorrido);
      if (nuevoDestino === destino) return;
      destino = nuevoDestino;
      if (cambioDePosicion) animar();
      else desplazamiento.setValue(destino);
    },
  };
}

/**
 * Atrás del navegador cierra la hoja abierta (Hoja, MenuOpciones,
 * SelectorUbicacion). Solo web: en Android lo hace Modal con onRequestClose.
 *
 * Cada hoja que se abre suma una entrada al historial con la misma URL y una
 * marca en history.state. Atrás vuelve a la entrada de abajo y cierra la hoja
 * de arriba; ese popstate no le llega a Expo Router, que sigue en la misma
 * entrada. Cerrar la hoja desde la interfaz quita su entrada, si sigue siendo
 * la actual.
 *
 * Quitar una entrada es asincrónico (history.go). Mientras tanto, lo que otra
 * parte de la app escriba en el historial (Expo Router al navegar) espera y
 * se aplica después, sobre la entrada correcta. Si la app navega con hojas
 * abiertas, primero se quitan sus entradas: así no quedan huérfanas.
 */

export const MARCA_HOJA = 'hojaEncontrados';

/** Si el popstate de un retroceso propio no llega en este tiempo, se sigue igual. */
export const ESPERA_RETROCESO_MS = 500;

type Url = string | URL | null | undefined;

export type Ventana = {
  history: {
    readonly state: unknown;
    pushState(datos: unknown, sinUso: string, url?: Url): void;
    replaceState(datos: unknown, sinUso: string, url?: Url): void;
    go(delta?: number): void;
  };
  location: { readonly href: string };
  /** Escucha popstate antes que Expo Router (en captura). */
  alVolver(escucha: (evento: { stopImmediatePropagation(): void }) => void): void;
  /** Programa una función y devuelve cómo cancelarla. */
  esperar(fn: () => void, ms: number): () => void;
};

export type HistorialDeHojas = {
  /** Registra una hoja abierta; cerrar es lo que hace Atrás. Devuelve su token. */
  abrir(cerrar: () => void): number;
  /** La hoja se cerró desde la interfaz o se desmontó. */
  cerrar(token: number): void;
  /** Corre fn ahora o, si hay un retroceso propio en camino, cuando llegue. */
  cuandoTermine(fn: () => void): void;
};

type Hoja = {
  token: number;
  cerrar: () => void;
  abierta: boolean;
  /** Su entrada está en el historial del navegador. */
  conEntrada: boolean;
  /** La entrada sobre la que se sumó la suya. */
  base: { id: unknown; url: string } | null;
};

type Estado = Record<string, unknown> | null;

export function crearHistorialDeHojas(ventana: Ventana): HistorialDeHojas {
  const { history } = ventana;
  const original = {
    pushState: history.pushState.bind(history),
    replaceState: history.replaceState.bind(history),
    go: history.go.bind(history),
  };

  // De abajo hacia arriba. Una hoja cerrada sigue acá mientras su entrada
  // no se pudo quitar (había otra hoja arriba).
  const hojas: Hoja[] = [];
  let siguienteToken = 1;
  let retrocediendo = false;
  let cancelarEspera: (() => void) | null = null;
  const pendientes: (() => void)[] = [];

  const estado = (): Estado =>
    typeof history.state === 'object' ? (history.state as Estado) : null;
  const marcaActual = () => estado()?.[MARCA_HOJA];

  const vaciar = () => {
    while (!retrocediendo && pendientes.length > 0) pendientes.shift()?.();
  };

  // Corre ahora o, si hay un retroceso propio en camino, cuando llegue.
  const enOrden = (accion: () => void) => {
    if (retrocediendo) pendientes.push(accion);
    else accion();
  };

  const terminarRetroceso = () => {
    retrocediendo = false;
    cancelarEspera?.();
    cancelarEspera = null;
    vaciar();
  };

  const retroceder = (entradas: number) => {
    retrocediendo = true;
    cancelarEspera = ventana.esperar(terminarRetroceso, ESPERA_RETROCESO_MS);
    original.go(-entradas);
  };

  // Las hojas de arriba con entrada, si la actual es la de la más alta.
  const conEntradaArriba = (): Hoja[] => {
    const arriba: Hoja[] = [];
    for (let i = hojas.length - 1; i >= 0 && hojas[i].conEntrada; i--) arriba.push(hojas[i]);
    return arriba.length > 0 && marcaActual() === arriba[0].token ? arriba : [];
  };

  const olvidar = (hoja: Hoja) => {
    hoja.conEntrada = false;
    const i = hojas.indexOf(hoja);
    if (!hoja.abierta && i !== -1) hojas.splice(i, 1);
  };

  // Quita las entradas de las hojas cerradas que quedaron arriba.
  const limpiar = () => {
    for (const hoja of hojas.filter((h) => !h.abierta && !h.conEntrada)) olvidar(hoja);
    const arriba = conEntradaArriba();
    const primeraAbierta = arriba.findIndex((h) => h.abierta);
    const cerradas = primeraAbierta === -1 ? arriba : arriba.slice(0, primeraAbierta);
    if (cerradas.length === 0) return;
    for (const hoja of cerradas) olvidar(hoja);
    retroceder(cerradas.length);
  };

  // Otra parte de la app navega: primero se quitan las entradas de las hojas.
  // sobreLaHoja corre antes en la entrada de la hoja, que queda adelante.
  const antesDeNavegar = (navegar: () => void, sobreLaHoja?: () => void) =>
    enOrden(() => {
      const arriba = conEntradaArriba();
      if (arriba.length === 0) return navegar();
      sobreLaHoja?.();
      for (const hoja of arriba) olvidar(hoja);
      retroceder(arriba.length);
      pendientes.push(navegar);
    });

  history.pushState = (datos, sinUso, url) =>
    antesDeNavegar(() => original.pushState(datos, sinUso, url));

  history.replaceState = (datos, sinUso, url) =>
    enOrden(() => {
      const arriba = conEntradaArriba();
      const mismaUrl = () =>
        url == null || new URL(url, ventana.location.href).href === ventana.location.href;
      if (arriba.length > 0 && typeof datos === 'object' && mismaUrl()) {
        // Solo actualiza la entrada, sin navegar: la de la hoja conserva su marca.
        return original.replaceState({ ...datos, [MARCA_HOJA]: arriba[0].token }, sinUso, url);
      }
      // router.replace: la entrada que queda adelante pasa a ser la nueva, así
      // Adelante no vuelve a la pantalla reemplazada.
      const reemplazar = () => original.replaceState(datos, sinUso, url);
      antesDeNavegar(reemplazar, reemplazar);
    });

  history.go = (delta = 0) => {
    if (delta >= 0) return enOrden(() => original.go(delta));
    antesDeNavegar(() => original.go(delta));
  };

  ventana.alVolver((evento) => {
    if (retrocediendo) {
      // Es el popstate de un retroceso propio: Expo Router no se entera.
      evento.stopImmediatePropagation();
      terminarRetroceso();
      return;
    }
    // Atrás (o Adelante) del navegador: se cierran las hojas que quedaron arriba.
    const marca = marcaActual();
    const destino = hojas.findIndex((h) => h.conEntrada && h.token === marca);
    const dejadas = hojas.slice(destino + 1).filter((h) => h.conEntrada);
    if (dejadas.length === 0) return;
    const base = dejadas[0].base;
    for (const hoja of dejadas.reverse()) {
      hoja.conEntrada = false;
      hojas.splice(hojas.indexOf(hoja), 1);
      if (hoja.abierta) {
        hoja.abierta = false;
        hoja.cerrar();
      }
    }
    // Si volvió a la entrada de abajo, la ruta es la misma: Expo Router no se
    // entera. Si saltó más atrás, navega como siempre.
    if (base && estado()?.id === base.id && ventana.location.href === base.url) {
      evento.stopImmediatePropagation();
    }
    limpiar();
  });

  return {
    abrir(cerrar) {
      const hoja: Hoja = {
        token: siguienteToken++,
        cerrar,
        abierta: true,
        conEntrada: false,
        base: null,
      };
      hojas.push(hoja);
      enOrden(() => {
        if (!hoja.abierta) return olvidar(hoja);
        const actual = estado();
        const url = ventana.location.href;
        hoja.base = { id: actual?.id, url };
        original.pushState({ ...actual, [MARCA_HOJA]: hoja.token }, '', url);
        hoja.conEntrada = true;
      });
      return hoja.token;
    },
    cerrar(token) {
      const hoja = hojas.find((h) => h.token === token);
      if (!hoja?.abierta) return;
      hoja.abierta = false;
      enOrden(limpiar);
    },
    cuandoTermine: enOrden,
  };
}

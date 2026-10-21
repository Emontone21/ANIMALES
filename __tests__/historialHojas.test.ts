import { crearHistorialDeHojas, MARCA_HOJA, type Ventana } from '@/lib/historialHojas';

type Entrada = { estado: Record<string, unknown> | null; url: string };

/**
 * Un navegador mínimo: history.go es asincrónico (corre con avanzar()) y el
 * popstate pasa primero por la escucha en captura y después por la del
 * "router", como en el navegador con Expo Router.
 */
function crearNavegador(url = 'https://spot.test/animal/1') {
  const entradas: Entrada[] = [{ estado: { id: 'r:0' }, url }];
  let indice = 0;
  let captura: Parameters<Ventana['alVolver']>[0] | null = null;
  const router: { id: unknown; url: string }[] = [];
  const traslados: (() => void)[] = [];
  const temporizadores: (() => void)[] = [];

  const resolver = (destino: string | URL | null | undefined) =>
    destino == null ? entradas[indice].url : new URL(destino, entradas[indice].url).href;

  const trasladar = (delta: number) =>
    traslados.push(() => {
      const destino = indice + delta;
      if (destino < 0 || destino >= entradas.length || delta === 0) return;
      indice = destino;
      let detenido = false;
      captura?.({ stopImmediatePropagation: () => (detenido = true) });
      if (!detenido) router.push({ id: entradas[indice].estado?.id, url: entradas[indice].url });
    });

  const history: Ventana['history'] = {
    get state() {
      return entradas[indice].estado;
    },
    pushState(datos, _sinUso, destino) {
      entradas.splice(indice + 1);
      entradas.push({ estado: datos as Entrada['estado'], url: resolver(destino) });
      indice++;
    },
    replaceState(datos, _sinUso, destino) {
      entradas[indice] = { estado: datos as Entrada['estado'], url: resolver(destino) };
    },
    go(delta = 0) {
      trasladar(delta);
    },
  };

  const ventana: Ventana = {
    history,
    location: {
      get href() {
        return entradas[indice].url;
      },
    },
    alVolver: (escucha) => {
      captura = escucha;
    },
    esperar: (fn) => {
      temporizadores.push(fn);
      return () => temporizadores.splice(temporizadores.indexOf(fn), 1);
    },
  };

  return {
    ventana,
    historial: crearHistorialDeHojas(ventana),
    /** Atrás del navegador (no pasa por history.go de la app). */
    atras: () => trasladar(-1),
    /** Mantener apretado Atrás y elegir una entrada anterior. */
    saltar: (delta: number) => trasladar(delta),
    /** Corre los traslados pendientes, como el navegador en la próxima tarea. */
    avanzar: () => {
      while (traslados.length > 0) traslados.shift()?.();
    },
    /** Lo que Expo Router haría al navegar a otra ruta. */
    navegar: (ruta: string, id: string) => history.pushState({ id }, '', ruta),
    vencerEsperas: () => {
      while (temporizadores.length > 0) temporizadores.shift()?.();
    },
    entradas: () => entradas.slice(0, indice + 1).map((e) => e.url.replace(/^https:\/\/[^/]+/, '')),
    adelante: () => entradas.slice(indice + 1).map((e) => e.url.replace(/^https:\/\/[^/]+/, '')),
    marca: () => entradas[indice].estado?.[MARCA_HOJA],
    router,
  };
}

describe('Atrás cierra la hoja abierta en web (historialHojas)', () => {
  test('abrir suma una entrada con la misma URL y Atrás la cierra sin avisarle al router', () => {
    const n = crearNavegador();
    const cerrar = jest.fn();
    const token = n.historial.abrir(cerrar);
    expect(n.entradas()).toEqual(['/animal/1', '/animal/1']);
    expect(n.marca()).toBe(token);

    n.atras();
    n.avanzar();
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(n.entradas()).toEqual(['/animal/1']);
    expect(n.router).toEqual([]);
  });

  test('cerrar desde la interfaz quita su entrada: un solo Atrás sale de la pantalla', () => {
    const n = crearNavegador();
    n.navegar('/animal/2', 'r:1');
    const cerrar = jest.fn();
    const token = n.historial.abrir(cerrar);
    n.historial.cerrar(token);
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1', '/animal/2']);
    expect(n.router).toEqual([]);
    expect(cerrar).not.toHaveBeenCalled();

    n.atras();
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1']);
    expect(n.router).toEqual([{ id: 'r:0', url: 'https://spot.test/animal/1' }]);
  });

  test('cerrar y navegar enseguida no deja una entrada huérfana', () => {
    const n = crearNavegador();
    const token = n.historial.abrir(jest.fn());
    n.historial.cerrar(token);
    n.navegar('/animal/1/editar', 'r:1');
    // La navegación espera a que se quite la entrada de la hoja.
    expect(n.entradas()).toEqual(['/animal/1', '/animal/1']);
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1', '/animal/1/editar']);
    expect(n.adelante()).toEqual([]);
    expect(n.router).toEqual([]);
  });

  test('navegar con la hoja abierta tampoco deja entradas huérfanas', () => {
    const n = crearNavegador();
    const cerrar = jest.fn();
    const token = n.historial.abrir(cerrar);
    n.navegar('/auth/ingresar', 'r:1');
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1', '/auth/ingresar']);
    // Después se desmonta: su entrada ya no está, no retrocede.
    n.historial.cerrar(token);
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1', '/auth/ingresar']);
    expect(cerrar).not.toHaveBeenCalled();
  });

  test('con hojas anidadas, Atrás cierra primero la de arriba', () => {
    const n = crearNavegador();
    const cerrarAbajo = jest.fn();
    const cerrarArriba = jest.fn();
    n.historial.abrir(cerrarAbajo);
    n.historial.abrir(cerrarArriba);
    expect(n.entradas()).toHaveLength(3);

    n.atras();
    n.avanzar();
    expect(cerrarArriba).toHaveBeenCalledTimes(1);
    expect(cerrarAbajo).not.toHaveBeenCalled();
    expect(n.entradas()).toHaveLength(2);

    n.atras();
    n.avanzar();
    expect(cerrarAbajo).toHaveBeenCalledTimes(1);
    expect(n.entradas()).toEqual(['/animal/1']);
    expect(n.router).toEqual([]);
  });

  test('una hoja que reemplaza a otra (Más opciones → Denunciar) deja una sola entrada', () => {
    const n = crearNavegador();
    const menu = n.historial.abrir(jest.fn());
    const cerrarDenuncia = jest.fn();
    // React corre primero la limpieza del menú y después el efecto de la denuncia.
    n.historial.cerrar(menu);
    n.historial.abrir(cerrarDenuncia);
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1', '/animal/1']);

    n.atras();
    n.avanzar();
    expect(cerrarDenuncia).toHaveBeenCalledTimes(1);
    expect(n.entradas()).toEqual(['/animal/1']);
    expect(n.router).toEqual([]);
  });

  test('una hoja de abajo cerrada mientras hay otra arriba se quita con la de arriba', () => {
    const n = crearNavegador();
    const abajo = n.historial.abrir(jest.fn());
    const arriba = n.historial.abrir(jest.fn());
    n.historial.cerrar(abajo);
    n.avanzar();
    expect(n.entradas()).toHaveLength(3);
    n.historial.cerrar(arriba);
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1']);
  });

  test('reemplazar la entrada sin cambiar la URL conserva la hoja', () => {
    const n = crearNavegador();
    const token = n.historial.abrir(jest.fn());
    n.ventana.history.replaceState({ id: 'r:0' }, '', '/animal/1');
    expect(n.entradas()).toEqual(['/animal/1', '/animal/1']);
    expect(n.marca()).toBe(token);
  });

  test('router.replace con la hoja abierta reemplaza la entrada de abajo', () => {
    const n = crearNavegador();
    n.historial.abrir(jest.fn());
    n.ventana.history.replaceState({ id: 'r:0' }, '', '/');
    n.avanzar();
    expect(n.entradas()).toEqual(['/']);
    // La entrada de la hoja queda adelante, igual a la nueva: Adelante no vuelve al caso.
    expect(n.adelante()).toEqual(['/']);
  });

  test('router.back con la hoja abierta vuelve a la pantalla anterior', () => {
    const n = crearNavegador();
    n.navegar('/animal/2', 'r:1');
    n.historial.abrir(jest.fn());
    n.ventana.history.go(-1);
    n.avanzar();
    expect(n.entradas()).toEqual(['/animal/1']);
    // Solo le llega al router su propio retroceso.
    expect(n.router).toEqual([{ id: 'r:0', url: 'https://spot.test/animal/1' }]);
  });

  test('si el popstate propio no llega, lo pendiente se aplica igual', () => {
    const n = crearNavegador();
    const token = n.historial.abrir(jest.fn());
    n.historial.cerrar(token);
    n.navegar('/casos', 'r:1');
    expect(n.entradas()).toHaveLength(2);
    n.vencerEsperas();
    expect(n.entradas()).toEqual(['/animal/1', '/animal/1', '/casos']);
  });

  test('saltar varias entradas atrás cierra las hojas y deja navegar al router', () => {
    const n = crearNavegador();
    n.navegar('/animal/2', 'r:1');
    const cerrar = jest.fn();
    n.historial.abrir(cerrar);
    n.saltar(-2);
    n.avanzar();
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(n.entradas()).toEqual(['/animal/1']);
    expect(n.router).toEqual([{ id: 'r:0', url: 'https://spot.test/animal/1' }]);
  });
});

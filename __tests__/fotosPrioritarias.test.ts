import { cuandoTerminenLasPrioritarias, empezoFotoPrioritaria } from '@/lib/fotosPrioritarias';

describe('Fotos prioritarias (el mapa web espera a que bajen)', () => {
  test('sin fotos bajando, avisa enseguida', () => {
    const fn = jest.fn();
    cuandoTerminenLasPrioritarias(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('avisa cuando termina la última, una sola vez aunque una avise dos veces', () => {
    const terminarA = empezoFotoPrioritaria();
    const terminarB = empezoFotoPrioritaria();
    const fn = jest.fn();
    cuandoTerminenLasPrioritarias(fn);
    terminarA();
    terminarA();
    expect(fn).not.toHaveBeenCalled();
    terminarB();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('se puede cancelar', () => {
    const terminar = empezoFotoPrioritaria();
    const fn = jest.fn();
    const cancelar = cuandoTerminenLasPrioritarias(fn);
    cancelar();
    terminar();
    expect(fn).not.toHaveBeenCalled();
  });
});

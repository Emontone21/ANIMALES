import { FILTROS_INICIALES, aplicarFiltros, ordenarPorCercania } from '@/features/reportes/filtros';
import { distanciaMetros, MONTEVIDEO } from '@/lib/ubicacion';

import { casoEnMapa } from './datos/casos';

const AHORA = new Date('2026-10-19T12:00:00Z');

const perdido = casoEnMapa({ id: 'p' });
const encontrado = casoEnMapa({
  id: 'e',
  tipo_reporte: 'encontrado',
  nombre: null,
  especie: 'gato',
});
const reunido = casoEnMapa({ id: 'r', estado: 'reunido' });
const viejo = casoEnMapa({
  id: 'v',
  ultimo_avistamiento_en: null,
  ultimo_visto_en: '2026-08-01T12:00:00Z',
});
const todos = [perdido, encontrado, reunido, viejo];
const ids = (lista: { id: string }[]) => lista.map((a) => a.id);

describe('aplicarFiltros', () => {
  test('al empezar: activos de los últimos 30 días', () => {
    expect(ids(aplicarFiltros(todos, FILTROS_INICIALES, AHORA))).toEqual(['p', 'e']);
  });

  test('por tipo y por especie', () => {
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, tipo: 'perdido' }, AHORA))).toEqual([
      'p',
    ]);
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, especie: 'gato' }, AHORA))).toEqual([
      'e',
    ]);
  });

  test('un estado concreto, también los cerrados', () => {
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, estado: 'reunido' }, AHORA))).toEqual([
      'r',
    ]);
  });

  test('antigüedad: sin fecha de último avistamiento usa la de la última vez visto', () => {
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, antiguedad: 'todo' }, AHORA))).toEqual(
      ['p', 'e', 'v'],
    );
    const hace2h = casoEnMapa({ id: 'h', ultimo_avistamiento_en: '2026-10-19T10:00:00Z' });
    const hace2d = casoEnMapa({ id: 'd', ultimo_avistamiento_en: '2026-10-17T10:00:00Z' });
    expect(
      ids(aplicarFiltros([hace2h, hace2d], { ...FILTROS_INICIALES, antiguedad: '24h' }, AHORA)),
    ).toEqual(['h']);
  });
});

describe('ordenarPorCercania', () => {
  const cerca = casoEnMapa({ id: 'cerca', lng: -56.165, lat: -34.902 });
  const lejos = casoEnMapa({ id: 'lejos', lng: -56.05, lat: -34.85 });

  test('del más cercano al más lejano, con la distancia en km', () => {
    const orden = ordenarPorCercania([lejos, cerca], MONTEVIDEO);
    expect(orden.map((c) => c.animal.id)).toEqual(['cerca', 'lejos']);
    expect(orden[0].km).toBeLessThan(0.2);
    expect(orden[1].km).toBeGreaterThan(10);
  });

  test('el seleccionado en el mapa va primero', () => {
    expect(ordenarPorCercania([cerca, lejos], MONTEVIDEO, 'lejos')[0].animal.id).toBe('lejos');
  });

  test('sin centro no hay distancias', () => {
    expect(ordenarPorCercania([cerca], null)[0].km).toBeNull();
  });
});

test('distanciaMetros: una cuadra de Montevideo mide unos 100 m', () => {
  const d = distanciaMetros([-56.1645, -34.9011], [-56.1645, -34.9002]);
  expect(d).toBeGreaterThan(90);
  expect(d).toBeLessThan(110);
});

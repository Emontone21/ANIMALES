import {
  desdeParaPedir,
  MARGEN_MS,
  marcarLeidosEnCache,
  milisegundos,
  sumarMensajes,
} from '@/features/mensajes/incremental';

const m = (id: string, created_at: string, emisor_id = 'yo', leido_en: string | null = null) => ({
  id,
  created_at,
  emisor_id,
  leido_en,
});

describe('mensajes: pedir solo lo nuevo (M20)', () => {
  test('lee las fechas de Postgres con microsegundos', () => {
    expect(milisegundos('2026-10-21T12:28:08.474245+00:00')).toBe(
      Date.parse('2026-10-21T12:28:08.474Z'),
    );
    expect(milisegundos('2026-10-21T12:28:08+00:00')).toBe(Date.parse('2026-10-21T12:28:08Z'));
  });

  test('sin mensajes, se pide todo', () => {
    expect(desdeParaPedir(undefined)).toBeNull();
    expect(desdeParaPedir([])).toBeNull();
  });

  test('con mensajes, desde el último menos el margen', () => {
    const previos = [
      m('a', '2026-10-21T12:00:00.000000+00:00'),
      m('b', '2026-10-21T12:05:00.500+00:00'),
    ];
    expect(desdeParaPedir(previos)).toBe(
      new Date(Date.parse('2026-10-21T12:05:00.500Z') - MARGEN_MS).toISOString(),
    );
    expect(desdeParaPedir(previos)).toBe('2026-10-21T12:04:50.500Z');
  });

  test('suma lo nuevo sin repetir lo que vuelve a llegar por el margen', () => {
    const previos = [m('a', '2026-10-21T12:00:00+00:00'), m('b', '2026-10-21T12:05:00+00:00')];
    const nuevos = [m('b', '2026-10-21T12:05:00+00:00'), m('c', '2026-10-21T12:05:03+00:00')];
    expect(sumarMensajes(previos, nuevos).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  test('un mensaje que se guardó con una hora anterior al último entra en su lugar', () => {
    const previos = [m('a', '2026-10-21T12:00:00+00:00'), m('c', '2026-10-21T12:05:03+00:00')];
    const nuevos = [m('b', '2026-10-21T12:05:01+00:00'), m('c', '2026-10-21T12:05:03+00:00')];
    expect(sumarMensajes(previos, nuevos).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  test('la versión nueva de un mensaje reemplaza a la vieja', () => {
    const previos = [m('a', '2026-10-21T12:00:00+00:00', 'otra')];
    const nuevos = [m('a', '2026-10-21T12:00:00+00:00', 'otra', '2026-10-21T12:01:00+00:00')];
    expect(sumarMensajes(previos, nuevos)[0].leido_en).toBe('2026-10-21T12:01:00+00:00');
  });

  test('al marcarlos leídos, la caché cambia solo los ajenos sin leer', () => {
    const lista = [
      m('a', '2026-10-21T12:00:00+00:00', 'otra'),
      m('b', '2026-10-21T12:01:00+00:00', 'yo'),
      m('c', '2026-10-21T12:02:00+00:00', 'otra', '2026-10-21T12:02:30+00:00'),
    ];
    const marcados = marcarLeidosEnCache(lista, 'yo', 'ahora');
    expect(marcados.map((x) => x.leido_en)).toEqual(['ahora', null, '2026-10-21T12:02:30+00:00']);
  });
});

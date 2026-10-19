import { fechaDe, fechaPerdidoDe } from '@/components/reportes/SelectorCuando';
import { desdeCuando, diaYHora, fechaHoraCorta, fechaLarga, hace, haceCuanto } from '@/lib/fechas';

// Montevideo es UTC−3 todo el año: 12:00 UTC son las 9:00 en Uruguay.
const AHORA = new Date('2026-10-19T12:00:00Z');

describe('haceCuanto', () => {
  test.each([
    ['2026-10-19T11:59:30Z', 'recién'],
    ['2026-10-19T11:55:00Z', 'hace 5 minutos'],
    ['2026-10-19T09:00:00Z', 'hace 3 horas'],
    ['2026-10-18T12:00:00Z', 'ayer'],
    ['2026-10-16T12:00:00Z', 'hace 3 días'],
    ['2026-10-12T12:00:00Z', 'hace 1 semana'],
    ['2026-09-28T12:00:00Z', 'hace 3 semanas'],
  ])('%s → %s', (fecha, esperado) => {
    expect(haceCuanto(fecha, AHORA)).toBe(esperado);
  });

  test('una fecha futura (reloj desfasado) cuenta como recién', () => {
    expect(haceCuanto('2026-10-19T12:10:00Z', AHORA)).toBe(haceCuanto(AHORA, AHORA));
  });
});

describe('diaYHora, en horario de Uruguay', () => {
  test('hoy, ayer y otro día', () => {
    expect(diaYHora('2026-10-19T12:40:00Z', AHORA)).toBe('Hoy a las 09:40');
    expect(diaYHora('2026-10-18T21:05:00Z', AHORA)).toBe('Ayer a las 18:05');
    expect(diaYHora('2026-10-17T12:40:00Z', AHORA)).toBe('17/10 a las 09:40');
  });

  test('a las 2:00 UTC todavía es el día anterior en Montevideo', () => {
    // 19/10 02:00 UTC = 18/10 23:00 en Uruguay: "ayer" visto desde el 19 a las 9.
    expect(diaYHora('2026-10-19T02:00:00Z', AHORA)).toBe('Ayer a las 23:00');
  });
});

describe('desdeCuando (Perdido desde…)', () => {
  test('hoy, ayer, en la semana y antes', () => {
    expect(desdeCuando('2026-10-19T10:00:00Z', AHORA)).toBe('hoy');
    expect(desdeCuando('2026-10-18T10:00:00Z', AHORA)).toBe('ayer');
    expect(desdeCuando('2026-10-17T15:00:00Z', AHORA)).toBe('el sábado 17');
    expect(desdeCuando('2026-10-03T15:00:00Z', AHORA)).toBe('el 3 de octubre');
  });
});

describe('fechaLarga y fechaHoraCorta', () => {
  test('versión de los términos', () => {
    expect(fechaLarga('2026-10-19')).toBe('19 de octubre de 2026');
  });

  test('un texto que no es fecha queda igual', () => {
    expect(fechaLarga('borrador')).toBe('borrador');
  });

  test('fecha y hora corta en Montevideo', () => {
    expect(fechaHoraCorta('2026-10-17T17:05:00Z')).toBe('17/10/2026, 14:05');
  });
});

describe('¿Cuándo lo viste? y ¿Cuándo se perdió?', () => {
  test('hace N horas', () => {
    expect(hace(3, AHORA).toISOString()).toBe('2026-10-19T09:00:00.000Z');
  });

  test('opciones rápidas al publicar o avisar', () => {
    expect(fechaDe('ahora', AHORA)).toEqual(AHORA);
    expect(fechaDe('hace1h', AHORA).toISOString()).toBe('2026-10-19T11:00:00.000Z');
    expect(fechaDe('ayer', AHORA).toISOString()).toBe('2026-10-18T12:00:00.000Z');
  });

  test('un perdido se cuenta en días', () => {
    expect(fechaPerdidoDe('hoy', AHORA)).toEqual(AHORA);
    expect(fechaPerdidoDe('hace3d', AHORA).toISOString()).toBe('2026-10-16T12:00:00.000Z');
    expect(fechaPerdidoDe('dosSemanas', AHORA).toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });
});

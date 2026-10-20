import { resumenCoincidencia } from '@/features/coincidencias/resumen';
import { t } from '@/i18n/es-UY';

const perro = { especie: 'perro' as const, tipo: 'encontrado' as const, nombre: null };

describe('Posibles coincidencias: qué dice cada una', () => {
  test('las del reconocimiento con IA muestran el motivo en vez del porcentaje', () => {
    const r = resumenCoincidencia(
      {
        motivo: 'Mismo collar rojo y mancha blanca en el pecho',
        similitud: 0.86,
        distancia_m: 1200,
        horas_diferencia: 3,
      },
      perro,
    );
    expect(r.motivo).toBe('Mismo collar rojo y mancha blanca en el pecho.');
    expect(r.oracion).toBe(
      `Un perro encontrado ${t.mapa.distancia(1.2).toLowerCase()}. Con 3 h de diferencia.`,
    );
    expect(r.oracion).not.toMatch(/%/);
  });

  test('con nombre (un perdido) y sin distancia ni horas', () => {
    const r = resumenCoincidencia(
      {
        motivo: '¿Misma mancha en la oreja?',
        similitud: 0.9,
        distancia_m: null,
        horas_diferencia: null,
      },
      { especie: 'perro', tipo: 'perdido', nombre: 'Toby' },
    );
    expect(r).toEqual({ oracion: 'Toby, perdido.', motivo: '¿Misma mancha en la oreja?' });
  });

  test('las de antes, sin motivo, siguen con el porcentaje de parecido', () => {
    for (const motivo of [null, '   ']) {
      const r = resumenCoincidencia(
        { motivo, similitud: 0.861, distancia_m: 1200, horas_diferencia: null },
        perro,
      );
      expect(r.motivo).toBeNull();
      expect(r.oracion).toBe(t.coincidencias.resumen('perro', 'encontrado', null, 1.2, 86));
    }
  });
});

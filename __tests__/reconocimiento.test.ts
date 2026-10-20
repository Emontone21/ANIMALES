import { avisoProcesar, cuando, resultadoProcesar } from '@/features/reconocimiento/estado';
import { t } from '@/i18n/es-UY';

describe('Moderación › Reconocimiento', () => {
  test('lo que devuelve la RPC de procesar', () => {
    expect(resultadoProcesar('enviado')).toBe('enviado');
    expect(resultadoProcesar('sin_pendientes')).toBe('sin_pendientes');
    expect(resultadoProcesar('sin_configurar')).toBe('sin_configurar');
    // Algo que no conoce la app se toma como enviado: la llamada salió.
    expect(resultadoProcesar('otra cosa')).toBe('enviado');
  });

  test('qué dice cada resultado', () => {
    expect(avisoProcesar('enviado')).toEqual({ texto: t.reconocimiento.enviado, tipo: 'exito' });
    expect(avisoProcesar('sin_pendientes')).toEqual({
      texto: t.reconocimiento.sinPendientes,
      tipo: 'info',
    });
    expect(avisoProcesar('sin_configurar').texto).toBe(t.reconocimiento.sinConfigurarAyuda);
  });

  test('cuándo pasó por última vez', () => {
    const ahora = new Date('2026-10-20T17:00:00Z'); // 14:00 en Montevideo
    expect(cuando('2026-10-20T15:05:00Z', ahora)).toBe(t.fechas.hoyALas('12:05'));
    expect(cuando(null, ahora)).toBe(t.reconocimiento.nunca);
  });

  test('las pendientes que esperan un nuevo intento', () => {
    expect(t.reconocimiento.reintentando(1)).toBe('1 espera un nuevo intento');
    expect(t.reconocimiento.reintentando(3)).toBe('3 esperan un nuevo intento');
  });
});

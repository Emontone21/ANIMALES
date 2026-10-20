import {
  avisoProcesar,
  avisoReactivar,
  cuando,
  enElTope,
  estadoGeneral,
  etiquetaEstado,
  filaError,
  puedeProcesar,
  resultadoProcesar,
} from '@/features/reconocimiento/estado';
import { t } from '@/i18n/es-UY';

describe('Moderación › Reconocimiento', () => {
  test('lo que devuelve la RPC de procesar', () => {
    expect(resultadoProcesar('enviado')).toBe('enviado');
    expect(resultadoProcesar('sin_pendientes')).toBe('sin_pendientes');
    expect(resultadoProcesar('sin_configurar')).toBe('sin_configurar');
    expect(resultadoProcesar('apagado')).toBe('apagado');
    expect(resultadoProcesar('pausado')).toBe('pausado');
    expect(resultadoProcesar('tope_diario')).toBe('tope_diario');
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
    expect(avisoProcesar('apagado').texto).toBe(t.reconocimiento.apagadoAyuda);
    expect(avisoProcesar('pausado').texto).toBe(t.reconocimiento.pausadoAyuda);
    expect(avisoProcesar('tope_diario').texto).toBe(t.reconocimiento.topeAlcanzado);
  });

  test('después de Reactivar', () => {
    expect(avisoReactivar('enviado')).toEqual({
      texto: t.reconocimiento.reactivado,
      tipo: 'exito',
    });
    expect(avisoReactivar('sin_pendientes').texto).toBe(t.reconocimiento.reactivado);
    // Si se volvió a quedar sin lugar, o lo apagaron, lo dice.
    expect(avisoReactivar('tope_diario').texto).toBe(t.reconocimiento.topeAlcanzado);
    expect(avisoReactivar('apagado').texto).toBe(t.reconocimiento.apagadoAyuda);
  });

  test('el estado: sin configurar, apagado, pausado o andando', () => {
    const anda = { configurado: true, activa: true, pausa: null };
    expect(estadoGeneral(anda)).toBe('configurado');
    expect(estadoGeneral({ ...anda, configurado: false })).toBe('sin_configurar');
    expect(estadoGeneral({ ...anda, activa: false })).toBe('apagado');
    expect(estadoGeneral({ ...anda, pausa: 'sin_credito' })).toBe('pausado');
    // Sin configurar manda aunque esté apagado.
    expect(estadoGeneral({ configurado: false, activa: false, pausa: 'sin_credito' })).toBe(
      'sin_configurar',
    );
    expect(puedeProcesar(anda)).toBe(true);
    expect(puedeProcesar({ ...anda, pausa: 'sin_credito' })).toBe(false);
    expect(etiquetaEstado('pausado')).toEqual({
      texto: t.reconocimiento.pausado,
      fondo: 'peligroSuave',
      color: 'peligro',
      ayuda: t.reconocimiento.pausadoAyuda,
    });
    expect(etiquetaEstado('configurado').ayuda).toBeNull();
  });

  test('las llamadas de hoy, el tope y el costo del mes', () => {
    expect(enElTope({ llamadas_hoy: 299, tope_diario: 300 })).toBe(false);
    expect(enElTope({ llamadas_hoy: 300, tope_diario: 300 })).toBe(true);
    expect(t.reconocimiento.deTope(12, 300)).toBe('12 de 300');
    expect(t.reconocimiento.costo(0)).toBe('US$ 0');
    expect(t.reconocimiento.costo(0.0034)).toBe('Menos de US$ 0,01');
    expect(t.reconocimiento.costo(1.234)).toBe('US$ 1,23');
  });

  test('una llamada que falló', () => {
    const ahora = new Date('2026-10-20T17:00:00Z'); // 14:00 en Montevideo
    expect(
      filaError(
        { created_at: '2026-10-20T15:05:00Z', tipo: 'comparar', resultado: 'sin_credito' },
        ahora,
      ),
    ).toBe(`${t.fechas.hoyALas('12:05')} · Comparar · Sin crédito`);
    // Un resultado sin texto propio se muestra como error del servicio de IA.
    expect(
      filaError(
        { created_at: '2026-10-20T15:05:00Z', tipo: 'describir', resultado: 'en_curso' },
        ahora,
      ),
    ).toBe(`${t.fechas.hoyALas('12:05')} · Describir · ${t.reconocimiento.errorLlamada.error}`);
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

  test('la app dice "inteligencia artificial" o "IA", no la marca; solo la privacidad nombra al proveedor', () => {
    const marca = /claude|anthropic/i;
    const conMarca: string[] = [];
    const recorrer = (valor: unknown, ruta: string) => {
      if (ruta === 'legal.privacidad') return;
      // De las funciones se mira el código: los textos fijos de sus plantillas.
      if (typeof valor === 'string' || typeof valor === 'function') {
        if (marca.test(String(valor))) conMarca.push(ruta);
      } else if (valor && typeof valor === 'object') {
        for (const [clave, hijo] of Object.entries(valor)) {
          recorrer(hijo, ruta ? `${ruta}.${clave}` : clave);
        }
      }
    };
    recorrer(t, '');
    expect(conMarca).toEqual([]);
    expect(JSON.stringify(t.legal.privacidad)).toMatch(/Anthropic/);
    expect(JSON.stringify(t.legal.privacidad)).not.toMatch(/Claude/);
  });
});

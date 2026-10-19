import { t } from '@/i18n/es-UY';
import { ErrorVisible, esErrorDeRed, mensajeDeError } from '@/lib/errores';

const generico = t.comunes.errorGenerico;

describe('qué texto se muestra cuando algo falla', () => {
  test('sin error, el respaldo', () => {
    expect(mensajeDeError(null)).toBe(generico);
    expect(mensajeDeError(undefined, 'Otro')).toBe('Otro');
  });

  test('los textos de la app se muestran tal cual', () => {
    expect(mensajeDeError(new ErrorVisible('Listo el pollo'))).toBe('Listo el pollo');
  });

  test.each([
    'TypeError: Failed to fetch',
    'Load failed',
    'Network request failed',
    'NetworkError when attempting to fetch resource.',
  ])('sin conexión: %s', (mensaje) => {
    expect(esErrorDeRed(new TypeError(mensaje))).toBe(true);
    expect(mensajeDeError({ message: mensaje, code: '' })).toBe(t.comunes.sinConexion);
  });

  test('los avisos de las RPC (en español) se muestran', () => {
    expect(mensajeDeError({ message: 'Este caso ya está cerrado', code: '22023' })).toBe(
      'Este caso ya está cerrado',
    );
    expect(
      mensajeDeError({ message: 'Solo quien publicó el reporte puede cambiarlo', code: '42501' }),
    ).toBe('Solo quien publicó el reporte puede cambiarlo');
  });

  test('los errores en inglés de Postgres, PostgREST o Storage no', () => {
    expect(
      mensajeDeError(
        { message: 'invalid input syntax for type uuid: "abc"', code: '22P02' },
        t.animal.noEncontrado,
      ),
    ).toBe(t.animal.noEncontrado);
    expect(mensajeDeError({ message: 'permission denied for table animales', code: '42501' })).toBe(
      generico,
    );
    expect(
      mensajeDeError({ message: 'new row violates row-level security policy', code: '42501' }),
    ).toBe(generico);
    expect(mensajeDeError(new Error('Sin sesión'))).toBe(generico);
    expect(mensajeDeError('texto suelto')).toBe(generico);
  });
});

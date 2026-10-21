import { elegirClave, esClaveNueva } from '@/lib/env';

describe('clave pública de Supabase', () => {
  test('usa la publishable si está', () => {
    expect(elegirClave(' sb_publishable_abc ', 'eyJ.anon')).toBe('sb_publishable_abc');
  });

  test('sin publishable, la anon legacy de respaldo', () => {
    expect(elegirClave(undefined, 'eyJ.anon')).toBe('eyJ.anon');
    expect(elegirClave('   ', 'eyJ.anon')).toBe('eyJ.anon');
  });

  test('sin ninguna, falla con un mensaje que nombra las dos variables', () => {
    expect(() => elegirClave(undefined, undefined)).toThrow(
      'Falta la variable de entorno EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o EXPO_PUBLIC_SUPABASE_ANON_KEY)',
    );
  });

  test('las claves nuevas no son un JWT', () => {
    expect(esClaveNueva('sb_publishable_abc')).toBe(true);
    expect(esClaveNueva('eyJhbGciOiJIUzI1NiJ9.e30.x')).toBe(false);
  });
});

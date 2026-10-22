import { consultaInicial } from '@/features/reportes/precarga';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('Qué se adelanta según la ruta de entrada (precarga)', () => {
  test('el mapa y la lista piden los casos del mapa', () => {
    expect(consultaInicial('/')).toEqual({ tipo: 'mapa' });
    expect(consultaInicial('')).toEqual({ tipo: 'mapa' });
    expect(consultaInicial('/casos')).toEqual({ tipo: 'mapa' });
    expect(consultaInicial('/casos/')).toEqual({ tipo: 'mapa' });
  });

  test('el link de un caso pide ese caso', () => {
    const id = 'b0000000-0000-4000-8000-000000000004';
    expect(consultaInicial(`/animal/${id}`)).toEqual({ tipo: 'caso', id });
    expect(consultaInicial(`/animal/${id}/`)).toEqual({ tipo: 'caso', id });
  });

  test('el link de una historia del muro pide esa historia; el muro, nada', () => {
    const id = 'b0000000-0000-4000-8000-000000000004';
    expect(consultaInicial(`/reencuentros/${id}`)).toEqual({ tipo: 'historia', id });
    expect(consultaInicial(`/reencuentros/${id}/`)).toEqual({ tipo: 'historia', id });
    expect(consultaInicial('/reencuentros')).toBeNull();
    expect(consultaInicial(`/reencuentros/${id}/otra`)).toBeNull();
    expect(consultaInicial('/animal/abc/reencuentro')).toBeNull();
  });

  test('el resto no adelanta nada', () => {
    expect(consultaInicial('/animal/abc/editar')).toBeNull();
    expect(consultaInicial('/animal')).toBeNull();
    expect(consultaInicial('/perfil')).toBeNull();
    expect(consultaInicial('/conversacion/123')).toBeNull();
    expect(consultaInicial('/animal/%E0%A4%A')).toBeNull();
  });
});

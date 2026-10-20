import { casoDisponible } from '@/features/mensajes/casoDisponible';
import type { ConversacionDetalle } from '@/types/dominio';

describe('casoDisponible (conversaciones sobre un caso oculto, 0014)', () => {
  test('sigue la columna de la vista', () => {
    expect(casoDisponible({ animal_disponible: true })).toBe(true);
    expect(casoDisponible({ animal_disponible: false })).toBe(false);
  });

  test('sin la 0014 aplicada (sin la columna), el caso se ve', () => {
    const sinColumna = {} as Pick<ConversacionDetalle, 'animal_disponible'>;
    expect(casoDisponible(sinColumna)).toBe(true);
  });
});

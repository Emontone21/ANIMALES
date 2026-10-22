import { t } from '@/i18n/es-UY';
import {
  colorParaCompartir,
  datosParaCompartir,
  linkDelCaso,
  mensajeParaCompartir,
} from '@/lib/compartir';
import { mensajeCompleto } from '@/lib/hojaCompartir';
import type { DatosCompartir } from '@/types/dominio';

import { casoEnMapa } from './datos/casos';

const toby: DatosCompartir = datosParaCompartir(casoEnMapa());
const encontrado = (cambios: Partial<DatosCompartir> = {}): DatosCompartir => ({
  ...toby,
  tipo: 'encontrado',
  nombre: null,
  ...cambios,
});

test('el link usa EXPO_PUBLIC_SITE_URL sin la barra final', () => {
  expect(linkDelCaso('abc')).toBe('https://spot.test/animal/abc');
});

test('datosParaCompartir toma solo datos del animal, nunca el contacto ni la descripción', () => {
  expect(toby).toEqual({
    tipo: 'perdido',
    estado: 'avistado',
    nombre: 'Toby',
    especie: 'perro',
    color: 'Marrón',
    tamanio: 'mediano',
    tieneCollar: true,
  });
});

test('de un caso reunido, solo lo básico: el nombre y la especie (0027)', () => {
  const reunido = datosParaCompartir(casoEnMapa({ estado: 'reunido' }));
  expect(reunido).toEqual({
    tipo: 'perdido',
    estado: 'reunido',
    nombre: 'Toby',
    especie: 'perro',
    color: null,
    tamanio: null,
    tieneCollar: false,
  });
  expect(t.compartir.texto(reunido)).toBe('Toby ya volvió con su familia. Mirá el caso:');
  expect(t.compartir.vistaPrevia.descripcion(reunido)).toBe(
    'Perro. Gracias a todos los que ayudaron a buscarlo.',
  );
  // Como lo manda animales_detalle a quien no participó: sin el collar.
  expect(datosParaCompartir({ ...casoEnMapa({ estado: 'reunido' }), tiene_collar: null })).toEqual(
    reunido,
  );
});

describe('el color con números no se comparte (B37: podría ser un teléfono)', () => {
  test.each<[string | null, string | null]>([
    ['Marrón', 'Marrón'],
    ['  negro y blanco ', 'negro y blanco'],
    ['099 123 456', null],
    ['negro, llamar al 099123456', null],
    ['marrón 2', null],
    ['   ', null],
    [null, null],
  ])('%p → %p', (color, esperado) => {
    expect(colorParaCompartir(color)).toBe(esperado);
  });

  test('datosParaCompartir lo saca, y el texto y la vista previa quedan sin color', () => {
    const conTelefono = datosParaCompartir({ ...casoEnMapa(), color: 'negro 099 123 456' });
    expect(conTelefono.color).toBeNull();
    expect(t.compartir.texto(conTelefono)).toBe(
      'Se perdió Toby, perro mediano. Si lo viste, avisá acá:',
    );
    expect(t.compartir.vistaPrevia.descripcion(conTelefono)).not.toMatch(/\d/);
  });
});

describe('texto para compartir', () => {
  test.each<[string, DatosCompartir, string]>([
    ['perdido con nombre', toby, 'Se perdió Toby, perro marrón. Si lo viste, avisá acá:'],
    [
      'perdido sin nombre ni color',
      { ...toby, nombre: null, color: null },
      'Se perdió un perro mediano. Si lo viste, avisá acá:',
    ],
    [
      'encontrado',
      encontrado({ especie: 'gato', color: null, tamanio: null }),
      'Encontraron un gato. Si sabés de quién es, avisá acá:',
    ],
    [
      'encontrado resguardado',
      encontrado({ estado: 'resguardado' }),
      'Un perro marrón está a salvo y busca a su familia. Si sabés de quién es, avisá acá:',
    ],
    [
      'perdido reunido',
      { ...toby, estado: 'reunido' },
      'Toby ya volvió con su familia. Mirá el caso:',
    ],
    [
      'encontrado reunido',
      encontrado({ estado: 'reunido', especie: 'otro', color: null, tamanio: null }),
      'Un animal ya volvió con su familia. Mirá el caso:',
    ],
  ])('%s', (_nombre, caso, esperado) => {
    expect(t.compartir.texto(caso)).toBe(esperado);
  });

  test('mensaje completo: texto y link en un solo campo (nativo y WhatsApp)', () => {
    const mensaje = mensajeParaCompartir('abc', toby);
    expect(mensaje.titulo).toBe('Se perdió Toby');
    expect(mensajeCompleto(mensaje)).toBe(
      'Se perdió Toby, perro marrón. Si lo viste, avisá acá: https://spot.test/animal/abc',
    );
  });
});

describe('textos de la vista previa', () => {
  test.each<[string, DatosCompartir, string]>([
    ['perdido', toby, 'Se perdió Toby'],
    ['perdido sin nombre', { ...toby, nombre: null }, 'Se perdió un perro marrón'],
    ['encontrado', encontrado({ especie: 'gato' }), 'Gato encontrado'],
    ['resguardado', encontrado({ estado: 'resguardado' }), 'Perro encontrado, a salvo'],
    ['reunido con nombre', { ...toby, estado: 'reunido' }, 'Toby volvió con su familia'],
    ['reunido sin nombre', encontrado({ estado: 'reunido' }), 'Perro, de vuelta en casa'],
  ])('título: %s', (_nombre, caso, esperado) => {
    expect(t.compartir.vistaPrevia.titulo(caso)).toBe(esperado);
  });

  test('descripción con los datos estructurados y el pedido según el caso', () => {
    expect(t.compartir.vistaPrevia.descripcion(toby)).toBe(
      'Perro marrón, mediano, con collar. Si lo viste, avisá en Spot.',
    );
    expect(
      t.compartir.vistaPrevia.descripcion(
        encontrado({ color: null, tamanio: null, tieneCollar: false }),
      ),
    ).toBe('Perro. Si sabés de quién es, avisá en Spot.');
    expect(t.compartir.vistaPrevia.descripcion({ ...toby, estado: 'reunido' })).toContain(
      'Gracias a todos',
    );
  });
});

import { t } from '@/i18n/es-UY';
import { datosParaCompartir, linkDelCaso, mensajeParaCompartir } from '@/lib/compartir';
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
  expect(linkDelCaso('abc')).toBe('https://encontrados.test/animal/abc');
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
      'Se perdió Toby, perro marrón. Si lo viste, avisá acá: https://encontrados.test/animal/abc',
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
      'Perro marrón, mediano, con collar. Si lo viste, avisá en Encontrados.',
    );
    expect(
      t.compartir.vistaPrevia.descripcion(
        encontrado({ color: null, tamanio: null, tieneCollar: false }),
      ),
    ).toBe('Perro. Si sabés de quién es, avisá en Encontrados.');
    expect(t.compartir.vistaPrevia.descripcion({ ...toby, estado: 'reunido' })).toContain(
      'Gracias a todos',
    );
  });
});

import { MINIMO_PARA_EL_NUMERO, numeroVisible } from '@/features/reencuentros/contador';
import {
  accionDelFormulario,
  comoParticipo,
  errorDelFormulario,
  largo,
  LARGO_MAXIMO,
} from '@/features/reencuentros/reglas';
import { t } from '@/i18n/es-UY';
import { linkDeHistoria } from '@/lib/compartir';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const VACIO = { frase: '', mensaje: '', hayHistoria: false, marcados: 0 };

describe('el contador del muro', () => {
  test('con menos de 5 reencuentros no hay número: "Los primeros reencuentros de Spot"', () => {
    expect(MINIMO_PARA_EL_NUMERO).toBe(5);
    for (const n of [0, 1, 4, null, undefined]) expect(numeroVisible(n)).toBeNull();
    expect(numeroVisible(5)).toBe(5);
    expect(numeroVisible(34)).toBe(34);
    expect(t.reencuentros.tarjeta(numeroVisible(3))).toBe('Los primeros reencuentros de Spot');
    expect(t.reencuentros.tarjeta(numeroVisible(34))).toBe('34 volvieron a casa');
  });

  test('el número grande y lo que dice abajo', () => {
    expect(t.reencuentros.contadorDetalle(34)).toBe('animales volvieron a casa con Spot');
    expect(t.reencuentros.contadorAccesible(34)).toBe('34 animales volvieron a casa con Spot');
    expect(t.reencuentros.contadorAccesible(1)).toBe('1 animal volvió a casa con Spot');
  });
});

describe('los textos de una historia', () => {
  test('cuántos días estuvo perdido', () => {
    expect(t.reencuentros.dias(0)).toBe('Volvió a casa el mismo día');
    expect(t.reencuentros.dias(1)).toBe('Volvió a casa después de 1 día');
    expect(t.reencuentros.dias(12)).toBe('Volvió a casa después de 12 días');
  });

  test('sin el nombre (la familia no quiso mostrarlo), la especie', () => {
    expect(t.reencuentros.tituloHistoria('Toby', 'perro')).toBe('Toby');
    expect(t.reencuentros.tituloHistoria(null, 'perro')).toBe('Un perro');
    expect(t.reencuentros.tituloHistoria(null, 'gato')).toBe('Un gato');
  });

  test('el link de una historia y el texto para compartir', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    expect(linkDeHistoria(id)).toBe(`https://spot.test/reencuentros/${id}`);
    expect(t.reencuentros.compartirTexto('Toby')).toBe(
      'Toby volvió a casa con Spot. Mirá su historia:',
    );
  });

  test('en el perfil de quien ayudó', () => {
    expect(t.perfil.ayudaste(1)).toBe('Ayudaste a reunir a 1 familia.');
    expect(t.perfil.ayudaste(3)).toBe('Ayudaste a reunir a 3 familias.');
  });
});

describe('"Contá cómo volvió"', () => {
  test('el largo cuenta como la base: un emoji es uno', () => {
    expect(largo('hola')).toBe(4);
    expect(largo('🐶🐱')).toBe(2);
    expect('🐶'.length).toBe(2);
    expect(LARGO_MAXIMO).toBe(280);
  });

  test('cómo participó cada persona', () => {
    expect(comoParticipo({ lo_vio: true, lo_resguardo: false, le_escribio: true })).toBe(
      'Avisó que lo vio · Te escribió',
    );
    expect(comoParticipo({ lo_vio: false, lo_resguardo: true, le_escribio: false })).toBe(
      'Lo resguardó',
    );
    expect(comoParticipo({ lo_vio: false, lo_resguardo: false, le_escribio: false })).toBe('');
  });

  test('qué hace el botón: publicar, guardar o solo agradecer', () => {
    expect(accionDelFormulario({ ...VACIO, frase: 'Volvió solo' })).toBe('publicar');
    expect(accionDelFormulario({ ...VACIO, frase: 'Volvió', hayHistoria: true })).toBe('guardar');
    expect(accionDelFormulario({ ...VACIO, marcados: 2 })).toBe('agradecer');
    // Con frase, también agradece a los marcados (el mismo botón).
    expect(accionDelFormulario({ ...VACIO, frase: 'Volvió', marcados: 2 })).toBe('publicar');
    expect(accionDelFormulario({ ...VACIO, frase: '   ' })).toBeNull();
    expect(accionDelFormulario(VACIO)).toBeNull();
    // Editando, vaciar la frase no borra la historia: para eso está "Borrar la historia".
    expect(accionDelFormulario({ ...VACIO, hayHistoria: true, marcados: 1 })).toBeNull();
  });

  test('por qué no se puede guardar', () => {
    const textos = t.reencuentros.contar;
    expect(errorDelFormulario(VACIO)).toBe(textos.nadaQueGuardar);
    expect(errorDelFormulario({ ...VACIO, frase: 'a'.repeat(281) })).toBe(textos.fraseLarga);
    expect(errorDelFormulario({ ...VACIO, frase: 'a'.repeat(280) })).toBeNull();
    expect(errorDelFormulario({ ...VACIO, frase: '🐶'.repeat(280) })).toBeNull();
    expect(errorDelFormulario({ ...VACIO, marcados: 1, mensaje: 'b'.repeat(281) })).toBe(
      textos.mensajeLargo,
    );
    expect(errorDelFormulario({ ...VACIO, hayHistoria: true })).toBe(textos.fraseVacia);
    expect(errorDelFormulario({ ...VACIO, marcados: 1 })).toBeNull();
  });
});

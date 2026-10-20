import { perdidoDelPar, puedeResolver } from '@/features/coincidencias/api';
import {
  aQuienesLoVieron,
  avisosDeOtros,
  cambiosDisponibles,
  destinatariosDelCaso,
  permisosDelCaso,
} from '@/features/reportes/permisos';
import type { CoincidenciaDetalle } from '@/types/dominio';

import { casoDetalle, FAMILIA, OTRA, VECINA } from './datos/casos';

// coincidencias/api.ts usa el cliente de Supabase; para las reglas no hace falta.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const perdido = casoDetalle();
const encontrado = casoDetalle({ tipo_reporte: 'encontrado', nombre: null, creado_por: VECINA });

describe('quién cambia el estado de un perdido (las reglas de cambiar_estado_animal)', () => {
  test('la familia: reunido, no resguardado', () => {
    const p = permisosDelCaso(perdido, FAMILIA, null);
    expect(cambiosDisponibles(perdido, p)).toEqual(['reunido']);
    expect(p.puedeGestionar).toBe(true);
  });

  test('la vecina lo resguarda, pero no lo cierra', () => {
    const p = permisosDelCaso(perdido, VECINA, null);
    expect(cambiosDisponibles(perdido, p)).toEqual(['resguardar']);
    expect(p.puedeGestionar).toBe(false);
  });

  test('resguardado: solo la familia lo reabre o lo cierra, ni quien lo resguarda', () => {
    const resguardado = { ...perdido, estado: 'resguardado' as const };
    expect(cambiosDisponibles(resguardado, permisosDelCaso(resguardado, FAMILIA, VECINA))).toEqual([
      'reabrir',
      'reunido',
    ]);
    expect(cambiosDisponibles(resguardado, permisosDelCaso(resguardado, VECINA, VECINA))).toEqual(
      [],
    );
  });

  test('reunido: solo la familia lo reabre', () => {
    const reunido = { ...perdido, estado: 'reunido' as const };
    expect(cambiosDisponibles(reunido, permisosDelCaso(reunido, FAMILIA, null))).toEqual([
      'reabrir',
    ]);
    expect(cambiosDisponibles(reunido, permisosDelCaso(reunido, VECINA, null))).toEqual([]);
  });

  test('sin cuenta no hay cambios', () => {
    expect(cambiosDisponibles(perdido, permisosDelCaso(perdido, null, null))).toEqual([
      'resguardar',
    ]);
    expect(permisosDelCaso(perdido, null, null).esCreador).toBe(false);
  });
});

describe('quién cambia el estado de un encontrado', () => {
  test('quien lo resguarda lo cierra o dice que se volvió a escapar; un tercero, no', () => {
    const resguardado = { ...encontrado, estado: 'resguardado' as const };
    expect(cambiosDisponibles(resguardado, permisosDelCaso(resguardado, FAMILIA, FAMILIA))).toEqual(
      ['reabrir', 'reunido'],
    );
    expect(cambiosDisponibles(resguardado, permisosDelCaso(resguardado, OTRA, FAMILIA))).toEqual(
      [],
    );
  });

  test('reabrir un caso cerrado: solo quien lo publicó', () => {
    const reunido = { ...encontrado, estado: 'reunido' as const };
    expect(cambiosDisponibles(reunido, permisosDelCaso(reunido, VECINA, null))).toEqual([
      'reabrir',
    ]);
    expect(cambiosDisponibles(reunido, permisosDelCaso(reunido, FAMILIA, null))).toEqual([]);
  });

  test('un caso sin autor (cuenta borrada) no lo gestiona nadie', () => {
    const anonimo = { ...encontrado, creado_por: null };
    const p = permisosDelCaso(anonimo, VECINA, null);
    expect(p.esCreador).toBe(false);
    expect(p.puedeGestionar).toBe(false);
  });
});

describe('editar, borrar y compartir', () => {
  test('un reporte unido a otro no se edita ni se borra', () => {
    const vinculado = { ...encontrado, estado: 'vinculado' as const };
    expect(permisosDelCaso(vinculado, VECINA, null).puedeGestionar).toBe(false);
  });

  test('un caso oculto por moderación no se comparte', () => {
    expect(permisosDelCaso({ ...perdido, oculto: true }, VECINA, null).puedeCompartir).toBe(false);
    expect(permisosDelCaso(perdido, VECINA, null).puedeCompartir).toBe(true);
  });

  test('los avisos que se pierden son los de otras personas, también de cuentas borradas', () => {
    expect(
      avisosDeOtros(
        [{ usuario_id: FAMILIA }, { usuario_id: VECINA }, { usuario_id: null }],
        FAMILIA,
      ),
    ).toBe(2);
  });
});

describe('a quién se le escribe desde un caso', () => {
  test('a la familia y a quien lo resguarda, nunca a uno mismo', () => {
    expect(destinatariosDelCaso(perdido, VECINA, OTRA).map((d) => d.usuarioId)).toEqual([
      FAMILIA,
      VECINA,
    ]);
    expect(destinatariosDelCaso(perdido, VECINA, VECINA).map((d) => d.usuarioId)).toEqual([
      FAMILIA,
    ]);
    expect(destinatariosDelCaso(perdido, null, FAMILIA)).toEqual([]);
  });

  test('si quien publicó lo resguarda, aparece una sola vez', () => {
    expect(destinatariosDelCaso(encontrado, VECINA, OTRA)).toHaveLength(1);
  });

  test('a una cuenta borrada no se le escribe', () => {
    expect(destinatariosDelCaso({ ...encontrado, creado_por: null }, null, OTRA)).toEqual([]);
  });
});

describe('quién confirma una coincidencia (las reglas de resolver_coincidencia)', () => {
  const par = (cambios: Partial<CoincidenciaDetalle>) =>
    ({
      origen_tipo_reporte: 'encontrado',
      candidato_tipo_reporte: 'encontrado',
      origen_creado_por: VECINA,
      candidato_creado_por: OTRA,
      ...cambios,
    }) as CoincidenciaDetalle;

  test('con un perdido decide solo su familia, ni un moderador', () => {
    const c = par({ candidato_tipo_reporte: 'perdido', candidato_creado_por: FAMILIA });
    expect(perdidoDelPar(c)).toEqual({ hayPerdido: true, familia: FAMILIA });
    expect(puedeResolver(c, FAMILIA, false)).toBe(true);
    expect(puedeResolver(c, VECINA, false)).toBe(false);
    expect(puedeResolver(c, OTRA, true)).toBe(false);
  });

  test('entre dos encontrados: quien publicó cualquiera de los dos o un moderador', () => {
    const c = par({});
    expect(puedeResolver(c, VECINA, false)).toBe(true);
    expect(puedeResolver(c, OTRA, false)).toBe(true);
    expect(puedeResolver(c, FAMILIA, false)).toBe(false);
    expect(puedeResolver(c, FAMILIA, true)).toBe(true);
    expect(puedeResolver(c, null, true)).toBe(false);
  });

  test('un perdido cuya familia ya no está: no decide nadie', () => {
    const c = par({ origen_tipo_reporte: 'perdido', origen_creado_por: null });
    expect(puedeResolver(c, VECINA, true)).toBe(false);
  });
});

describe('Escribirle a quien lo vio (abrir_conversacion, 0014)', () => {
  const vistos = [
    { usuario_id: FAMILIA, tipo: 'perdido' as const },
    { usuario_id: VECINA, tipo: 'visto' as const },
    { usuario_id: null, tipo: 'visto' as const },
    { usuario_id: VECINA, tipo: 'visto' as const },
    { usuario_id: OTRA, tipo: 'resguardado' as const },
  ];

  test('quien publicó le escribe a cada persona que lo vio, una vez, ni a sí misma ni a una cuenta borrada', () => {
    expect(aQuienesLoVieron(perdido, vistos, FAMILIA)).toEqual([VECINA, OTRA]);
  });

  test('quien solo lo vio, no', () => {
    expect(aQuienesLoVieron(perdido, vistos, VECINA)).toEqual([]);
    expect(aQuienesLoVieron(perdido, vistos, null)).toEqual([]);
  });

  test('quien publicó un reporte unido al caso (su "encontrado" pasó al principal), también', () => {
    const conUnido = [...vistos, { usuario_id: OTRA, tipo: 'encontrado' as const }];
    expect(aQuienesLoVieron(perdido, conUnido, OTRA)).toEqual([FAMILIA, VECINA]);
  });

  test('en un caso oculto no se abren conversaciones nuevas', () => {
    expect(aQuienesLoVieron({ ...perdido, oculto: true }, vistos, FAMILIA)).toEqual([]);
  });
});

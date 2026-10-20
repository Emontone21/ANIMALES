import { assertEquals } from '@std/assert';

import { validarComparacion, validarDescripcion } from '../validar.ts';
import { DESCRIPCION_PERRO } from './ayudas.ts';

Deno.test('una descripción completa valida y se limpia', () => {
  const v = validarDescripcion({ ...DESCRIPCION_PERRO, collar_color: '  ', rasgos: [' cola corta '] });
  assertEquals(v, { ok: true, valor: { ...DESCRIPCION_PERRO, collar_color: null, rasgos: ['cola corta'] } });
});

Deno.test('una foto sin animal valida con especie "ninguno"', () => {
  const v = validarDescripcion({
    ...DESCRIPCION_PERRO,
    hay_animal: false,
    especie: 'ninguno',
    color_principal: 'no_se_ve',
    color_secundario: 'ninguno',
    raza_aproximada: null,
    rasgos: [],
  });
  assertEquals(v.ok, true);
});

Deno.test('una descripción que no cumple el esquema no valida', () => {
  const casos: [string, unknown][] = [
    ['no es un objeto', 'texto'],
    ['falta calidad', { ...DESCRIPCION_PERRO, calidad: undefined }],
    ['sobra telefono', { ...DESCRIPCION_PERRO, telefono: '099' }],
    ['especie y hay_animal', { ...DESCRIPCION_PERRO, especie: 'ninguno' }],
    ['especie y hay_animal', { ...DESCRIPCION_PERRO, hay_animal: false }],
    ['color_principal', { ...DESCRIPCION_PERRO, color_principal: 'violeta' }],
    ['tamanio', { ...DESCRIPCION_PERRO, tamanio: 'enorme' }],
    ['collar_color', { ...DESCRIPCION_PERRO, collar_color: 'r'.repeat(41) }],
    ['raza_aproximada', { ...DESCRIPCION_PERRO, raza_aproximada: 7 }],
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: Array(9).fill('mancha') }],
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: ['x'.repeat(81)] }],
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: [''] }],
  ];
  for (const [motivo, entrada] of casos) {
    const sinIndefinidos = typeof entrada === 'object' ? JSON.parse(JSON.stringify(entrada)) : entrada;
    assertEquals(validarDescripcion(sinIndefinidos), { ok: false, motivo }, motivo);
  }
});

const resultado = (candidato: string, cambios: Record<string, unknown> = {}) => ({
  candidato,
  confianza: 80,
  veredicto: 'mismo',
  motivo: 'Mismo collar rojo y mancha blanca en el pecho',
  coinciden: ['collar rojo'],
  difieren: [],
  ...cambios,
});

Deno.test('una comparación con un resultado por candidato valida, en cualquier orden', () => {
  const v = validarComparacion({ resultados: [resultado('C2'), resultado('C1', { confianza: 0 })] }, ['C1', 'C2']);
  assertEquals(v.ok, true);
  if (v.ok) assertEquals(v.valor.map((r) => r.candidato), ['C2', 'C1']);
});

Deno.test('una comparación que no cumple el esquema no valida', () => {
  const etiquetas = ['C1', 'C2'];
  const casos: [string, unknown][] = [
    ['1 resultados para 2 candidatos', { resultados: [resultado('C1')] }],
    ['candidato desconocido', { resultados: [resultado('C1'), resultado('C3')] }],
    ['candidato repetido', { resultados: [resultado('C1'), resultado('C1')] }],
    ['confianza', { resultados: [resultado('C1', { confianza: 101 }), resultado('C2')] }],
    ['confianza', { resultados: [resultado('C1', { confianza: 70.5 }), resultado('C2')] }],
    ['veredicto', { resultados: [resultado('C1', { veredicto: 'quizas' }), resultado('C2')] }],
    ['motivo', { resultados: [resultado('C1', { motivo: 'm'.repeat(141) }), resultado('C2')] }],
    ['motivo', { resultados: [resultado('C1', { motivo: '   ' }), resultado('C2')] }],
    ['coinciden o difieren', { resultados: [resultado('C1', { difieren: 'nada' }), resultado('C2')] }],
    ['sobra extra', { resultados: [resultado('C1', { extra: 1 }), resultado('C2')] }],
    ['sobra otra', { resultados: [resultado('C1'), resultado('C2')], otra: 1 }],
  ];
  for (const [motivo, entrada] of casos) {
    assertEquals(validarComparacion(entrada, etiquetas), { ok: false, motivo }, motivo);
  }
});

Deno.test('un motivo de exactamente 140 caracteres vale', () => {
  const v = validarComparacion({ resultados: [resultado('C1', { motivo: 'm'.repeat(140) })] }, ['C1']);
  assertEquals(v.ok, true);
});

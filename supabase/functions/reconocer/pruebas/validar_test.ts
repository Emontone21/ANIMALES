import { assert, assertEquals } from '@std/assert';

import { largo, recortar, validarComparacion, validarDescripcion } from '../validar.ts';
import { DESCRIPCION_PERRO } from './ayudas.ts';

Deno.test('una descripción completa valida y se limpia', () => {
  const v = validarDescripcion({ ...DESCRIPCION_PERRO, collar_color: '  ', rasgos: [' cola corta '] });
  assertEquals(v, {
    ok: true,
    valor: { ...DESCRIPCION_PERRO, collar_color: null, rasgos: ['cola corta'] },
    avisos: [],
  });
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
    // collar_color y raza no se recortan: un largo de más no vale, y se dice cuánto.
    ['collar_color: 41 > 40', { ...DESCRIPCION_PERRO, collar_color: 'r'.repeat(41) }],
    ['raza_aproximada: 61 > 60', { ...DESCRIPCION_PERRO, raza_aproximada: 'r'.repeat(61) }],
    ['raza_aproximada', { ...DESCRIPCION_PERRO, raza_aproximada: 7 }],
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: [''] }],
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: 'mancha' }],
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: ['mancha', 3] }],
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
    ['motivo', { resultados: [resultado('C1', { motivo: '   ' }), resultado('C2')] }],
    ['motivo', { resultados: [resultado('C1', { motivo: 7 }), resultado('C2')] }],
    ['coinciden o difieren', { resultados: [resultado('C1', { coinciden: [''] }), resultado('C2')] }],
    ['coinciden o difieren', { resultados: [resultado('C1', { difieren: 'nada' }), resultado('C2')] }],
    ['sobra extra', { resultados: [resultado('C1', { extra: 1 }), resultado('C2')] }],
    ['sobra otra', { resultados: [resultado('C1'), resultado('C2')], otra: 1 }],
  ];
  for (const [motivo, entrada] of casos) {
    assertEquals(validarComparacion(entrada, etiquetas), { ok: false, motivo }, motivo);
  }
});

Deno.test('un motivo de exactamente 140 caracteres vale tal cual, sin aviso', () => {
  const v = validarComparacion({ resultados: [resultado('C1', { motivo: 'm'.repeat(140) })] }, ['C1']);
  assertEquals(v.ok && [v.valor[0].motivo.length, v.avisos], [140, []]);
});

Deno.test('recortar: en el último espacio, con "…" incluido, sin la puntuación que queda colgando', () => {
  const texto = 'Mismo collar rojo, mancha blanca en el pecho y la oreja izquierda caída';
  assertEquals(recortar(texto, 100), texto);
  assertEquals(recortar(texto, 30), 'Mismo collar rojo, mancha…');
  // La coma antes del corte no queda colgando.
  assertEquals(recortar(texto, 20), 'Mismo collar rojo…');
  // Sin espacios, justo en el tope.
  assertEquals(recortar('x'.repeat(200), 140), `${'x'.repeat(139)}…`);
  // Un emoji cuenta como un carácter, igual que en Postgres, y no se parte.
  assertEquals(largo('🐶🐶'), 2);
  assertEquals(recortar('🐶'.repeat(10), 5), '🐶🐶🐶🐶…');
});

Deno.test('un motivo largo se recorta a 140 en el último espacio, con "…", y queda el aviso', () => {
  const motivo =
    'Mismo collar rojo y mancha blanca en el pecho; las orejas caídas y la cola corta coinciden en las dos ' +
    'fotos, aunque la luz y el ángulo cambian bastante';
  assert(largo(motivo) > 140);
  const v = validarComparacion({ resultados: [resultado('C1', { motivo }), resultado('C2')] }, ['C1', 'C2']);
  assert(v.ok);
  const recortado = v.valor[0].motivo;
  assert(largo(recortado) <= 140, `${largo(recortado)}`);
  assert(recortado.endsWith('…'));
  assert(motivo.startsWith(recortado.slice(0, -1)));
  assertEquals(motivo[recortado.length - 1], ' ');
  assertEquals(v.valor[1].motivo, resultado('C2').motivo);
  assertEquals(v.avisos, [`C1 motivo: ${largo(motivo)} > 140`]);
});

Deno.test('de más de 8 rasgos quedan los primeros 8, y uno de más de 80 se recorta; con avisos', () => {
  const rasgos = Array.from({ length: 11 }, (_, i) => `rasgo ${i + 1}`);
  rasgos[2] = 'una mancha blanca grande que le baja por el pecho hasta las patas delanteras, bien marcada';
  const v = validarDescripcion({ ...DESCRIPCION_PERRO, rasgos });
  assert(v.ok);
  assertEquals(v.valor.rasgos.length, 8);
  assertEquals(v.valor.rasgos.slice(0, 2), ['rasgo 1', 'rasgo 2']);
  assertEquals(v.valor.rasgos[7], 'rasgo 8');
  assert(largo(v.valor.rasgos[2]) <= 80 && v.valor.rasgos[2].endsWith('…'));
  assertEquals(v.avisos, ['rasgos: 11 > 8', `rasgos[3]: ${largo(rasgos[2])} > 80`]);
});

Deno.test('coinciden y difieren se recortan igual que los rasgos', () => {
  const v = validarComparacion({
    resultados: [resultado('C1', { coinciden: Array(9).fill('collar rojo'), difieren: ['y'.repeat(90)] })],
  }, ['C1']);
  assert(v.ok);
  assertEquals(v.valor[0].coinciden.length, 8);
  assertEquals(v.valor[0].difieren, [`${'y'.repeat(79)}…`]);
  assertEquals(v.avisos, ['C1 coinciden: 9 > 8', 'C1 difieren[1]: 90 > 80']);
});

Deno.test('lo inseguro se sigue rechazando aunque también haya algo para recortar', () => {
  const largoMotivo = { motivo: 'm '.repeat(100) };
  const otro = resultado('C2');
  const comparaciones: [string, unknown][] = [
    ['candidato desconocido', { resultados: [resultado('C9', largoMotivo), otro] }],
    ['candidato repetido', { resultados: [resultado('C2', largoMotivo), otro] }],
    ['confianza', { resultados: [resultado('C1', { ...largoMotivo, confianza: 101 }), otro] }],
    ['veredicto', { resultados: [resultado('C1', { ...largoMotivo, veredicto: 'seguro' }), otro] }],
    ['sobra telefono', { resultados: [resultado('C1', { ...largoMotivo, telefono: '099' }), otro] }],
    ['coinciden o difieren', { resultados: [resultado('C1', { coinciden: [...Array(10).fill('a'), ''] }), otro] }],
    ['1 resultados para 2 candidatos', { resultados: [resultado('C1', largoMotivo)] }],
  ];
  for (const [motivo, entrada] of comparaciones) {
    assertEquals(validarComparacion(entrada, ['C1', 'C2']), { ok: false, motivo }, motivo);
  }
  const muchos = Array(12).fill('mancha');
  const descripciones: [string, unknown][] = [
    ['especie', { ...DESCRIPCION_PERRO, rasgos: muchos, especie: 'dinosaurio' }],
    ['color_principal', { ...DESCRIPCION_PERRO, rasgos: muchos, color_principal: 'violeta' }],
    ['especie y hay_animal', { ...DESCRIPCION_PERRO, rasgos: muchos, hay_animal: false }],
    ['collar_color: 50 > 40', { ...DESCRIPCION_PERRO, rasgos: muchos, collar_color: 'c'.repeat(50) }],
    // Un elemento que no es texto, aunque esté después del 8, no vale.
    ['rasgos', { ...DESCRIPCION_PERRO, rasgos: [...muchos, null] }],
  ];
  for (const [motivo, entrada] of descripciones) {
    assertEquals(validarDescripcion(entrada), { ok: false, motivo }, motivo);
  }
});

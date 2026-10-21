import { assertEquals, assertThrows } from '@std/assert';

import {
  azar,
  type Consulta,
  medidasConLadoMayor,
  mezclar,
  rango,
  recomendar,
  type Resultado,
  sugiere,
  tabla,
} from '../../../../scripts/evaluar-ia.ts';

/** Un resultado coherente: "mismo" desde 50, "distinto" por debajo. */
const r = (probabilidad: number): Resultado => ({ probabilidad, veredicto: probabilidad >= 50 ? 'mismo' : 'distinto' });

const consulta = (mismo: number | null, otros: number[]): Consulta => ({
  animal: 'x',
  mismo: mismo === null ? null : r(mismo),
  otros: otros.map(r),
});

Deno.test('evaluar-ia: por umbral, qué parte reconoce a su animal y cuántos falsos por foto', () => {
  const consultas = [consulta(90, [75, 10]), consulta(72, [40, 30]), consulta(null, [])];
  assertEquals(tabla(consultas, [70, 80]), [
    { umbral: 70, reconoce: 2 / 3, falsosPorFoto: 1 / 3, paresFalsos: 1, totalFalsos: 4 },
    { umbral: 80, reconoce: 1 / 3, falsosPorFoto: 0, paresFalsos: 0, totalFalsos: 4 },
  ]);
});

Deno.test('evaluar-ia: recomienda el que más reconoce sin pasar de los falsos; nunca uno que no reconoce nada', () => {
  const filas = tabla([consulta(90, [75, 10]), consulta(72, [40, 30])], [60, 70, 80, 95]);
  assertEquals(recomendar(filas, 0.2)?.umbral, 80);
  assertEquals(recomendar(filas, 0.5)?.umbral, 70);
  assertEquals(recomendar(tabla([consulta(10, [90])], [50, 95]), 0.2), null);
});

Deno.test('evaluar-ia: rangos y azar con semilla', () => {
  assertEquals(rango('50:65:5'), [50, 55, 60, 65]);
  assertThrows(() => rango('50:65'));
  assertEquals(mezclar([1, 2, 3, 4, 5], azar(1)), mezclar([1, 2, 3, 4, 5], azar(1)));
  assertEquals(mezclar([1, 2, 3, 4, 5], azar(1)).sort(), [1, 2, 3, 4, 5]);
});

Deno.test('evaluar-ia: cuenta una coincidencia como la base, y "distinto" nunca, aunque el número sea alto', () => {
  assertEquals(sugiere({ probabilidad: 95, veredicto: 'distinto' }, 70), false);
  assertEquals(sugiere({ probabilidad: 70, veredicto: 'posible' }, 70), true);
  assertEquals(sugiere({ probabilidad: 69, veredicto: 'mismo' }, 70), false);
  const consultas: Consulta[] = [{
    animal: 'x',
    mismo: { probabilidad: 80, veredicto: 'posible' },
    otros: [{ probabilidad: 98, veredicto: 'distinto' }],
  }];
  assertEquals(tabla(consultas, [70]), [{ umbral: 70, reconoce: 1, falsosPorFoto: 0, paresFalsos: 0, totalFalsos: 1 }]);
});

Deno.test('evaluar-ia: la foto mediana deja el lado mayor en 640, sin agrandar', () => {
  assertEquals(medidasConLadoMayor(1280, 960, 640), { w: 640, h: 480 });
  assertEquals(medidasConLadoMayor(3000, 4000, 640), { w: 480, h: 640 });
  assertEquals(medidasConLadoMayor(500, 300, 640), { w: 500, h: 300 });
});

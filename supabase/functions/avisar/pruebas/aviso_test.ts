import { assertEquals, assertStrictEquals } from '@std/assert';

import { armarMensaje, nombreSeguro, TTL_SEGUNDOS } from '../aviso.ts';
import { aviso } from './ayudas.ts';

const ANIMAL = '11111111-2222-4333-8444-555555555555';
const CONVERSACION = '99999999-8888-4777-8666-555555555555';
const REPORTE = '12345678-1234-4234-8234-123456789012';

Deno.test('"lo vieron" con el nombre y, sin nombre, con la especie', () => {
  const { mensaje, opciones } = armarMensaje(aviso());
  assertEquals(mensaje, {
    titulo: 'Alguien vio a Toby',
    cuerpo: 'Tocá para ver dónde lo vieron.',
    url: `/animal/${ANIMAL}`,
    tag: `caso-${ANIMAL}`,
  });
  assertEquals(opciones, { urgencia: 'high', ttl: TTL_SEGUNDOS, topic: ANIMAL.replaceAll('-', '') });
  assertStrictEquals(opciones.topic?.length, 32);
  assertEquals(armarMensaje(aviso({ nombre: null })).mensaje.titulo, 'Alguien vio al perro');
  assertEquals(armarMensaje(aviso({ nombre: null, especie: 'gato' })).mensaje.titulo, 'Alguien vio al gato');
  assertEquals(armarMensaje(aviso({ nombre: null, especie: 'otro' })).mensaje.titulo, 'Alguien vio al animal');
});

Deno.test('resguardado, reunido y reabierto', () => {
  assertEquals(armarMensaje(aviso({ evento: 'resguardado' })).mensaje.titulo, 'Alguien tiene a Toby a salvo');
  const reunido = armarMensaje(aviso({ tipo: 'estado', evento: 'reunido', nombre: null }));
  assertEquals(reunido.mensaje.titulo, '¡El perro volvió con su familia!');
  assertEquals(reunido.opciones.urgencia, 'normal');
  assertEquals(
    armarMensaje(aviso({ tipo: 'estado', evento: 'reabierto' })).mensaje.titulo,
    'Toby se volvió a escapar',
  );
});

Deno.test('coincidencias: la familia de un perdido y quienes siguen el caso', () => {
  const familia = armarMensaje(aviso({ tipo: 'coincidencia', evento: null, para_familia: true }));
  assertEquals(familia.mensaje.titulo, 'Encontraron un animal parecido a Toby');
  assertEquals(familia.mensaje.cuerpo, 'Mirá las fotos y decidí si es o no.');
  assertEquals(familia.opciones.urgencia, 'high');
  assertEquals(
    armarMensaje(aviso({ tipo: 'coincidencia', evento: null, para_familia: true, nombre: null })).mensaje.titulo,
    'Encontraron un animal parecido al tuyo',
  );
  assertEquals(
    armarMensaje(aviso({ tipo: 'coincidencia', evento: null, nombre: null, especie: 'gato' })).mensaje.titulo,
    'Posible coincidencia con el gato',
  );
});

Deno.test('un mensaje nuevo: sin su texto ni quién lo mandó, y abre la conversación', () => {
  const { mensaje, opciones } = armarMensaje(
    aviso({ tipo: 'mensaje', evento: null, conversacion_id: CONVERSACION }),
  );
  assertEquals(mensaje, {
    titulo: 'Tenés un mensaje nuevo sobre Toby',
    cuerpo: 'Tocá para leerlo.',
    url: `/conversacion/${CONVERSACION}`,
    tag: `conversacion-${CONVERSACION}`,
  });
  assertEquals(opciones.topic, CONVERSACION.replaceAll('-', ''));
  // Si el caso ya no existe, sin nombre.
  assertEquals(
    armarMensaje(aviso({ tipo: 'mensaje', evento: null, conversacion_id: CONVERSACION, animal_id: null }))
      .mensaje.titulo,
    'Tenés un mensaje nuevo',
  );
});

Deno.test('reportes de errores: a moderación y a quien lo mandó', () => {
  const base = { tipo: 'error' as const, evento: null, animal_id: null, nombre: null, especie: null };
  const nuevo = armarMensaje(aviso({ ...base, reporte_error_id: REPORTE, moderacion: true }));
  assertEquals(nuevo.mensaje, {
    titulo: 'Llegó un reporte de un error',
    cuerpo: 'Tocá para verlo en moderación.',
    url: '/moderacion?seccion=errores',
    tag: 'moderacion',
  });
  assertStrictEquals(nuevo.opciones.topic, undefined);
  const resuelto = armarMensaje(aviso({ ...base, reporte_error_id: REPORTE }));
  assertEquals(resuelto.mensaje.url, '/actividad');
  assertEquals(resuelto.mensaje.tag, `error-${REPORTE}`);
});

Deno.test('un nombre que parece un contacto no va a la pantalla bloqueada', () => {
  assertEquals(nombreSeguro('  Toby  '), 'Toby');
  assertEquals(nombreSeguro('Doña Rosa'), 'Doña Rosa');
  for (
    const nombre of [
      'Toby 099 123 456',
      'toby@correo.example',
      'www.toby.uy',
      'https://x.example',
      'toby.com',
      'a'.repeat(31),
      '',
      null,
    ]
  ) {
    assertEquals(nombreSeguro(nombre), null, String(nombre));
  }
  assertEquals(armarMensaje(aviso({ nombre: 'Llamar 099123456' })).mensaje.titulo, 'Alguien vio al perro');
});

Deno.test('ids que no son uuid no arman rutas', () => {
  const { mensaje } = armarMensaje(aviso({ animal_id: '../../moderacion', tipo: 'estado', evento: 'reunido' }));
  assertEquals(mensaje.url, '/actividad');
  assertEquals(mensaje.tag, 'spot');
});

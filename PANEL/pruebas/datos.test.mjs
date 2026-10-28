// Lógica pura de la página: lo que llega del servidor, los avisos, los links,
// los errores del ingreso y los textos con números.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { t } from '../i18n/es-UY.js';
import { PARTES, TARJETAS } from '../js/catalogo.js';
import {
  avisosDe,
  codigoDeErrorDeIngreso,
  faltaConfigurar,
  normalizarConfig,
  normalizarDatos,
  normalizarEstado,
  resumenDe,
} from '../js/datos.js';
import { armarEnlaces } from '../js/enlaces.js';
import { bytes, diaDeSemana, fecha, fechaYHora, numero, porcentaje } from '../js/formato.js';
import { vistaDeHash } from '../js/inicio.js';
import { diasHasta, haceCuanto } from '../js/tiempo.js';

const REF = 'abcdefghijklmnopqrst';

const item = (id, estado, extra = {}) => ({
  id,
  estado,
  faltan: [],
  invalidas: [],
  prompt: null,
  motivo: null,
  datos: null,
  ...extra,
});

test('normalizarConfig acepta solo una URL de Supabase y una clave', () => {
  assert.deepEqual(
    normalizarConfig({ supabase: { url: `https://${REF}.supabase.co`, clavePublica: 'x' } }),
    {
      supabase: { url: `https://${REF}.supabase.co`, clavePublica: 'x' },
      faltan: [],
      invalidas: [],
    },
  );
  assert.equal(
    normalizarConfig({ supabase: { url: 'https://otro.example.org', clavePublica: 'x' } }).supabase,
    null,
  );
  assert.deepEqual(normalizarConfig({ faltan: ['SUPABASE_URL', '<img>', 3] }).faltan, [
    'SUPABASE_URL',
  ]);
  assert.equal(normalizarConfig(null).supabase, null);
});

test('normalizarEstado: un estado por cada id conocido, y falla si falta', () => {
  const estado = normalizarEstado({
    generadoEn: '2026-10-28T12:00:00.000Z',
    partes: [item('ingreso', 'ok'), item('desconocida', 'ok'), item('enlaces', 'raro')],
    tarjetas: [
      item('app.reunidos', 'ok', {
        prompt: 'otroQueNoExiste',
        faltan: ['NO VALE', 'LINK_APP_URL'],
        datos: { reunidos: 3, reunidos30d: 1, sobra: 'no' },
      }),
    ],
  });
  assert.equal(estado.generadoEn, Date.parse('2026-10-28T12:00:00.000Z'));
  assert.deepEqual([...estado.partes.keys()], PARTES);
  assert.deepEqual([...estado.tarjetas.keys()], TARJETAS);
  assert.equal(estado.partes.get('ingreso').estado, 'ok');
  assert.equal(estado.partes.get('enlaces').estado, 'falla');
  assert.equal(estado.partes.get('enlaces').motivo, 'sinEstado');
  assert.deepEqual(estado.tarjetas.get('app.reunidos').faltan, ['LINK_APP_URL']);
  assert.equal(estado.tarjetas.get('app.reunidos').prompt, null);
  assert.deepEqual(estado.tarjetas.get('app.reunidos').datos, { reunidos: 3, reunidos30d: 1 });
  assert.equal(estado.tarjetas.get('infra.vercel').motivo, 'sinEstado');
});

test('normalizarDatos: solo campos conocidos y con la forma esperada', () => {
  assert.equal(normalizarDatos(null), null);
  assert.equal(normalizarDatos(undefined), null);
  assert.equal(normalizarDatos('texto'), undefined);
  assert.equal(normalizarDatos([1]), undefined);
  assert.deepEqual(
    normalizarDatos({
      estado: 'READY',
      commit: '72e224e',
      creado: '2026-10-28T12:00:00.000Z',
      inspector: 'https://vercel.com/equipo/proyecto/abc',
      nombre: 'Esto no se muestra',
    }),
    {
      estado: 'READY',
      commit: '72e224e',
      creado: Date.parse('2026-10-28T12:00:00.000Z'),
      inspector: 'https://vercel.com/equipo/proyecto/abc',
    },
  );
  assert.deepEqual(normalizarDatos({ vence: null }), { vence: null });
  // Un valor que no cumple invalida toda la tarjeta.
  for (const malo of [
    { nuevos24h: -1 },
    { nuevos24h: 1.5 },
    { total: '12' },
    { estado: 'CANCELED' },
    { commit: '<b>' },
    { inspector: 'javascript:alert(1)' },
    { inspector: 'https://vercel.com.example.org/x' },
    { creado: 'ayer' },
    { porDia: [{ dia: '2026-10-28', casos: 1 }] },
    { baseLimite: 0 },
  ]) {
    assert.equal(normalizarDatos(malo), undefined, JSON.stringify(malo));
  }
  const sieteDias = Array.from({ length: 7 }, (_, i) => ({ dia: `2026-10-2${i}`, casos: i }));
  assert.equal(normalizarDatos({ porDia: sieteDias }).porDia.length, 7);
  // Si los datos no sirven, la tarjeta queda como "sin estado".
  const estado = normalizarEstado({
    partes: [],
    tarjetas: [item('app.usuarios', 'ok', { datos: { total: 'muchos' } })],
  });
  assert.equal(estado.tarjetas.get('app.usuarios').motivo, 'sinEstado');
  assert.equal(estado.tarjetas.get('app.usuarios').datos, null);
});

test('avisos: fallas primero; lo pendiente no avisa; la tarjeta con una variable inválida tampoco', () => {
  const todoOk = (estadoItem) =>
    [...PARTES.map((id) => item(id, 'ok'))].map((x) => ({ ...x, estado: estadoItem }));
  const base = normalizarEstado({
    partes: [
      ...todoOk('ok').filter((x) => !['enlaces', 'ingreso'].includes(x.id)),
      item('ingreso', 'atencion', { motivo: 'adminInvalidos' }),
      item('enlaces', 'falla', { invalidas: ['LINK_FACEBOOK_URL'] }),
    ],
    tarjetas: TARJETAS.map((id) =>
      id === 'redes.facebook'
        ? item(id, 'falla', { invalidas: ['LINK_FACEBOOK_URL'] })
        : id === 'infra.vercel'
          ? item(id, 'falla')
          : item(id, 'pendiente', { prompt: 'datosInternos' }),
    ),
  });
  const avisos = avisosDe(base);
  assert.deepEqual(
    avisos.map((a) => `${a.tipo}:${a.id}:${a.estado}`),
    ['parte:enlaces:falla', 'tarjeta:infra.vercel:falla', 'parte:ingreso:atencion'],
  );
  assert.deepEqual(resumenDe(avisos), { fallas: 2, atenciones: 1 });
  assert.equal(faltaConfigurar(base), true);
});

test('avisos: lo que ya avisa una parte no se repite en sus tarjetas', () => {
  const estado = normalizarEstado({
    partes: PARTES.map((id) =>
      id === 'datosInternos' ? item(id, 'falla', { motivo: 'supabaseNoResponde' }) : item(id, 'ok'),
    ),
    tarjetas: TARJETAS.map((id) => {
      if (id.startsWith('app.') || id === 'infra.supabase' || id === 'infra.vision') {
        return item(id, 'falla', { motivo: 'supabaseNoResponde' });
      }
      if (id === 'tokens.vercel') return item(id, 'falla', { motivo: 'tokenInvalido' });
      if (id === 'infra.vercel') {
        return item(id, 'falla', {
          motivo: 'deployFallo',
          datos: { estado: 'ERROR', commit: null, creado: null, inspector: null },
        });
      }
      return item(id, 'ok');
    }),
  });
  assert.deepEqual(
    avisosDe(estado).map((a) => `${a.tipo}:${a.id}:${a.motivo}`),
    [
      'parte:datosInternos:supabaseNoResponde',
      'tarjeta:infra.vercel:deployFallo',
      // La parte "Vercel" no lo avisa: entonces sí lo avisa su tarjeta.
      'tarjeta:tokens.vercel:tokenInvalido',
    ],
  );
});

test('resumen de avisos con plurales', () => {
  assert.equal(t.atencion.resumen(1, 2), '1 falla · 2 avisos');
  assert.equal(t.atencion.resumen(2, 1), '2 fallas · 1 aviso');
  assert.equal(t.atencion.resumen(0, 3), '3 avisos');
  assert.equal(t.atencion.resumen(0, 0), 'Nada para revisar');
});

test('los links: solo https y de los hosts esperados', () => {
  const vacio = armarEnlaces(undefined);
  assert.equal(vacio.supabase, null);
  assert.equal(vacio.vercel, null);
  assert.equal(vacio.facebook, null);
  assert.ok(vacio.fijos.tokensVercel.startsWith('https://vercel.com/'));

  const e = armarEnlaces({
    supabaseRef: REF,
    vercelEquipo: 'equipo',
    vercelProyecto: 'proyecto',
    appUrl: 'https://app.example.org/ruta',
    facebookUrl: 'javascript:alert(1)',
    instagramUrl: 'https://www.instagram.com/cuenta',
    linkedinUrl: 'https://linkedin.com.example.org/x',
  });
  assert.equal(e.supabase.editor, `https://supabase.com/dashboard/project/${REF}/editor`);
  assert.equal(e.supabase.usuarios, `https://supabase.com/dashboard/project/${REF}/auth/users`);
  assert.equal(e.vercel.deploys, 'https://vercel.com/equipo/proyecto/deployments');
  assert.equal(e.app.reencuentros, 'https://app.example.org/reencuentros');
  assert.equal(e.facebook, null);
  assert.equal(e.instagram, 'https://www.instagram.com/cuenta');
  assert.equal(e.linkedin, null);
  assert.equal(e.supabase.funciones, `https://supabase.com/dashboard/project/${REF}/functions`);
  assert.equal(
    armarEnlaces({ supabaseRef: '../../x', vercelEquipo: 'a/b', vercelProyecto: 'c' }).supabase,
    null,
  );
  assert.equal(armarEnlaces({ vercelEquipo: 'a/b', vercelProyecto: 'c' }).vercel, null);
});

test('errores del ingreso: un código propio, nunca el mensaje de Supabase', () => {
  assert.equal(
    codigoDeErrorDeIngreso({ code: 'invalid_credentials', status: 400 }),
    'credenciales',
  );
  assert.equal(
    codigoDeErrorDeIngreso({ code: 'email_not_confirmed', status: 400 }),
    'emailSinConfirmar',
  );
  assert.equal(codigoDeErrorDeIngreso({ code: 'captcha_failed', status: 400 }), 'captcha');
  assert.equal(
    codigoDeErrorDeIngreso({ code: 'over_request_rate_limit', status: 429 }),
    'muchosIntentos',
  );
  assert.equal(codigoDeErrorDeIngreso({ name: 'AuthRetryableFetchError', status: 0 }), 'red');
  assert.equal(codigoDeErrorDeIngreso({ status: 400 }), 'credenciales');
  assert.equal(codigoDeErrorDeIngreso({ status: 500, message: 'Database error' }), 'otro');
  assert.equal(codigoDeErrorDeIngreso(undefined), 'otro');
});

test('hace cuánto y las vistas del hash', () => {
  const ahora = Date.parse('2026-10-28T12:00:00Z');
  assert.equal(haceCuanto(ahora - 20 * 1000, ahora), 'recién');
  assert.equal(haceCuanto(ahora - 4 * 60 * 1000, ahora), 'hace 4 min');
  assert.equal(haceCuanto(ahora - 125 * 60 * 1000, ahora), 'hace 2 h');
  assert.equal(haceCuanto(ahora + 60 * 1000, ahora), 'recién');
  assert.equal(haceCuanto(ahora - 47 * 60 * 60 * 1000, ahora), 'hace 47 h');
  assert.equal(haceCuanto(ahora - 3 * 24 * 60 * 60 * 1000, ahora), 'hace 3 días');
  assert.equal(diasHasta(ahora + 10.5 * 24 * 60 * 60 * 1000, ahora), 10);
  assert.equal(diasHasta(ahora - 1000, ahora), 0);
  assert.equal(vistaDeHash(''), 'inicio');
  assert.equal(vistaDeHash('#/'), 'inicio');
  assert.equal(vistaDeHash('#/redes'), 'redes');
  assert.equal(vistaDeHash('#/cualquiera'), 'inicio');
});

test('números, tamaños y fechas en es-UY y en la hora de Montevideo', () => {
  assert.equal(numero(12345), '12.345');
  assert.equal(bytes(999), '999 B');
  assert.equal(bytes(12_345_678), '12,3 MB');
  assert.equal(bytes(1_000_000_000), '1 GB');
  assert.equal(porcentaje(12_345_678, 500_000_000), '2,5 %');
  assert.equal(porcentaje(2, 1), '100 %');
  // 17:05 UTC son las 14:05 en Montevideo (UTC−3).
  assert.equal(fechaYHora(Date.parse('2026-10-28T17:05:00Z')), '28/10/26, 14:05');
  assert.equal(fecha(Date.parse('2026-12-01T12:00:00Z')), '1 de diciembre de 2026');
  assert.equal(diaDeSemana('2026-10-28'), 'miércoles');
});

test('textos con números: plurales', () => {
  assert.equal(t.datos.fotosEnEspera(1), 'foto en espera');
  assert.equal(t.datos.fotosEnEspera(3), 'fotos en espera');
  assert.equal(t.datos.ocultos(1, 2), '1 caso oculto · 2 historias ocultas');
  assert.equal(t.datos.vence('1 de diciembre de 2026', 0), 'Vence el 1 de diciembre de 2026: hoy.');
  assert.equal(
    t.datos.vence('1 de diciembre de 2026', 1),
    'Vence el 1 de diciembre de 2026, en 1 día.',
  );
  assert.equal(t.tiempo.dias(1), 'hace 1 día');
});

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
  normalizarEstado,
  resumenDe,
} from '../js/datos.js';
import { armarEnlaces } from '../js/enlaces.js';
import { vistaDeHash } from '../js/inicio.js';
import { haceCuanto } from '../js/tiempo.js';

const REF = 'abcdefghijklmnopqrst';

const item = (id, estado, extra = {}) => ({
  id,
  estado,
  faltan: [],
  invalidas: [],
  prompt: null,
  migracion: false,
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
      item('app.casosNuevos', 'pendiente', {
        prompt: 'datosInternos',
        faltan: ['NO VALE', 'LINK_APP_URL'],
      }),
    ],
  });
  assert.equal(estado.generadoEn, Date.parse('2026-10-28T12:00:00.000Z'));
  assert.deepEqual([...estado.partes.keys()], PARTES);
  assert.deepEqual([...estado.tarjetas.keys()], TARJETAS);
  assert.equal(estado.partes.get('ingreso').estado, 'ok');
  assert.equal(estado.partes.get('enlaces').estado, 'falla');
  assert.equal(estado.partes.get('enlaces').motivo, 'sinEstado');
  assert.deepEqual(estado.tarjetas.get('app.casosNuevos').faltan, ['LINK_APP_URL']);
  assert.equal(estado.tarjetas.get('infra.vercel').motivo, 'sinEstado');
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
    visionUrl: 'https://huggingface.co/spaces/a/b',
  });
  assert.equal(e.supabase.editor, `https://supabase.com/dashboard/project/${REF}/editor`);
  assert.equal(e.supabase.usuarios, `https://supabase.com/dashboard/project/${REF}/auth/users`);
  assert.equal(e.vercel.deploys, 'https://vercel.com/equipo/proyecto/deployments');
  assert.equal(e.app.reencuentros, 'https://app.example.org/reencuentros');
  assert.equal(e.facebook, null);
  assert.equal(e.instagram, 'https://www.instagram.com/cuenta');
  assert.equal(e.linkedin, null);
  assert.equal(e.vision, 'https://huggingface.co/spaces/a/b');
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
  assert.equal(vistaDeHash(''), 'inicio');
  assert.equal(vistaDeHash('#/'), 'inicio');
  assert.equal(vistaDeHash('#/redes'), 'redes');
  assert.equal(vistaDeHash('#/cualquiera'), 'inicio');
});

// Pruebas de api/config y api/estado con variables y un Supabase Auth falsos.
// Correr con: node --test pruebas/   (desde PANEL/)

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { esClavePublica, refDeSupabase, urlDeVision } from '../api/_comun.js';
import { responderConfig } from '../api/config.js';
import { responderEstado } from '../api/estado.js';

const REF = 'abcdefghijklmnopqrst';
const ADMIN = '00000000-0000-4000-8000-000000000001';
const OTRA = '00000000-0000-4000-8000-000000000002';
const TOKEN_ADMIN = 'token-de-prueba-de-la-cuenta-admin';
const TOKEN_OTRA = 'token-de-prueba-de-otra-cuenta-cualquiera';
const PUBLISHABLE = 'sb_publishable_clave-de-prueba-no-real';

const jwt = (payload) =>
  ['e30', globalThis.Buffer.from(JSON.stringify(payload)).toString('base64url'), 'firma'].join('.');

const BASE = {
  SUPABASE_URL: `https://${REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
  ADMIN_USER_IDS: ADMIN,
};

/** Supabase Auth falso: anota los pedidos y responde según el token. */
function authFalso({ caido = false } = {}) {
  const pedidos = [];
  const pedir = async (url, opciones) => {
    pedidos.push({ url, opciones });
    if (caido) throw new TypeError('fetch failed');
    const token = opciones.headers.Authorization.replace('Bearer ', '');
    if (token === TOKEN_ADMIN) return Response.json({ id: ADMIN });
    if (token === TOKEN_OTRA) return Response.json({ id: OTRA });
    return Response.json({ code: 'bad_jwt' }, { status: 403 });
  };
  return { pedir, pedidos };
}

const pedido = (token, ruta = '/api/estado') =>
  new Request(`https://panel.example.org${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

async function leer(respuesta) {
  const texto = await respuesta.text();
  return { estado: respuesta.status, cuerpo: JSON.parse(texto), texto, headers: respuesta.headers };
}

test('sin ninguna variable, config dice qué falta y no rompe', async () => {
  const { estado, cuerpo, headers } = await leer(await responderConfig(pedido(), {}));
  assert.equal(estado, 200);
  assert.equal(cuerpo.supabase, null);
  assert.deepEqual(cuerpo.faltan, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ADMIN_USER_IDS']);
  assert.equal(cuerpo.enlaces, undefined);
  assert.equal(headers.get('cache-control'), 'no-store');
});

test('sin sesión, config da solo lo necesario para entrar', async () => {
  const env = { ...BASE, LINK_VERCEL_TEAM: 'equipo-de-prueba', VERCEL_API_TOKEN: 'x'.repeat(30) };
  const { estado, cuerpo } = await leer(await responderConfig(pedido(), env));
  assert.equal(estado, 200);
  assert.deepEqual(Object.keys(cuerpo).sort(), ['faltan', 'invalidas', 'supabase']);
  assert.deepEqual(cuerpo.supabase, {
    url: `https://${REF}.supabase.co`,
    clavePublica: PUBLISHABLE,
  });
});

test('una clave que no es pública nunca llega al navegador', async () => {
  const claves = [
    jwt({ role: 'service_role', iss: 'supabase' }),
    'sb_secret_clave-de-prueba-no-real',
    'cualquier-otra-cosa',
  ];
  for (const clave of claves) {
    const env = { ...BASE, SUPABASE_PUBLISHABLE_KEY: clave };
    const { cuerpo, texto } = await leer(await responderConfig(pedido(), env));
    assert.equal(cuerpo.supabase, null, clave);
    assert.deepEqual(cuerpo.invalidas, ['SUPABASE_PUBLISHABLE_KEY']);
    assert.equal(texto.includes(clave), false);
  }
  assert.equal(esClavePublica(jwt({ role: 'anon' })), true);
});

test('con sesión de administración, config suma los datos de los links', async () => {
  const { pedir } = authFalso();
  const env = {
    ...BASE,
    LINK_APP_URL: 'https://app.example.org/algo',
    LINK_VERCEL_TEAM: 'equipo-de-prueba',
    LINK_VERCEL_PROJECT: 'proyecto-de-prueba',
    LINK_FACEBOOK_URL: 'https://www.facebook.com/pagina-de-prueba',
    LINK_INSTAGRAM_URL: 'javascript:alert(1)',
    LINK_LINKEDIN_URL: 'https://evil.example.org/linkedin.com',
    LINK_VISION_URL: 'https://huggingface.co/spaces/duenio/espacio',
  };
  const { estado, cuerpo } = await leer(await responderConfig(pedido(TOKEN_ADMIN), env, pedir));
  assert.equal(estado, 200);
  assert.deepEqual(cuerpo.enlaces, {
    supabaseRef: REF,
    appUrl: 'https://app.example.org',
    vercelEquipo: 'equipo-de-prueba',
    vercelProyecto: 'proyecto-de-prueba',
    facebookUrl: 'https://www.facebook.com/pagina-de-prueba',
    instagramUrl: null,
    linkedinUrl: null,
    visionUrl: 'https://huggingface.co/spaces/duenio/espacio',
  });
});

test('config con una sesión que no sirve o de otra cuenta', async () => {
  const { pedir } = authFalso();
  assert.equal(
    (await responderConfig(pedido('token-cualquiera-que-no-existe'), BASE, pedir)).status,
    401,
  );
  assert.equal((await responderConfig(pedido(TOKEN_OTRA), BASE, pedir)).status, 403);
  const malformado = new Request('https://panel.example.org/api/config', {
    headers: { Authorization: 'Basic abc' },
  });
  assert.equal((await responderConfig(malformado, BASE, pedir)).status, 401);
});

test('estado valida la sesión contra /auth/v1/user con la clave en apikey', async () => {
  const { pedir, pedidos } = authFalso();
  const respuesta = await responderEstado(pedido(TOKEN_ADMIN), BASE, pedir);
  assert.equal(respuesta.status, 200);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].url, `https://${REF}.supabase.co/auth/v1/user`);
  assert.equal(pedidos[0].opciones.headers.apikey, PUBLISHABLE);
  assert.equal(pedidos[0].opciones.headers.Authorization, `Bearer ${TOKEN_ADMIN}`);
  assert.equal(pedidos[0].opciones.redirect, 'error');
});

test('estado: 401 sin sesión, 403 sin permiso, 502 si Supabase no responde, 503 sin configurar', async () => {
  const { pedir } = authFalso();
  assert.equal((await responderEstado(pedido(), BASE, pedir)).status, 401);
  assert.equal(
    (await responderEstado(pedido('token-cualquiera-que-no-existe'), BASE, pedir)).status,
    401,
  );
  const otra = await leer(await responderEstado(pedido(TOKEN_OTRA), BASE, pedir));
  assert.equal(otra.estado, 403);
  assert.deepEqual(otra.cuerpo, { error: 'sinPermiso' });
  assert.equal(
    (await responderEstado(pedido(TOKEN_ADMIN), BASE, authFalso({ caido: true }).pedir)).status,
    502,
  );
  assert.equal((await responderEstado(pedido(TOKEN_ADMIN), {}, pedir)).status, 503);
  // Sin ADMIN_USER_IDS nadie entra.
  const sinLista = { ...BASE, ADMIN_USER_IDS: 'no-es-un-id' };
  assert.equal((await responderEstado(pedido(TOKEN_ADMIN), sinLista, pedir)).status, 503);
});

test('estado con solo lo básico: todo pendiente o sin configurar, nada con datos', async () => {
  const { pedir } = authFalso();
  const { cuerpo } = await leer(await responderEstado(pedido(TOKEN_ADMIN), BASE, pedir));
  const partes = Object.fromEntries(cuerpo.partes.map((p) => [p.id, p]));
  const tarjetas = Object.fromEntries(cuerpo.tarjetas.map((x) => [x.id, x]));

  assert.equal(partes.ingreso.estado, 'ok');
  assert.equal(partes.enlaces.estado, 'sinConfigurar');
  assert.equal(partes.datosInternos.estado, 'pendiente');
  assert.equal(partes.vercel.estado, 'sinConfigurar');
  assert.deepEqual(partes.vercel.faltan, [
    'VERCEL_API_TOKEN',
    'LINK_VERCEL_TEAM',
    'LINK_VERCEL_PROJECT',
  ]);
  assert.equal(partes.alertas.estado, 'pendiente');

  assert.equal(tarjetas['app.casosNuevos'].estado, 'pendiente');
  assert.equal(tarjetas['app.casosNuevos'].migracion, true);
  assert.equal(tarjetas['app.reunidos'].estado, 'pendiente');
  assert.deepEqual(tarjetas['app.reunidos'].faltan, ['LINK_APP_URL']);
  assert.equal(tarjetas['infra.vercel'].estado, 'sinConfigurar');
  assert.equal(tarjetas['redes.linkedin'].estado, 'sinConfigurar');
  for (const item of [...cuerpo.partes, ...cuerpo.tarjetas]) {
    assert.ok(['ok', 'pendiente', 'sinConfigurar'].includes(item.estado), item.id);
    assert.deepEqual(Object.keys(item).sort(), [
      'estado',
      'faltan',
      'id',
      'invalidas',
      'migracion',
      'prompt',
    ]);
  }
});

test('estado nunca devuelve el valor de una variable', async () => {
  const { pedir } = authFalso();
  const secretos = {
    VERCEL_API_TOKEN: 'secreto-de-vercel-de-prueba-123',
    META_ACCESS_TOKEN: 'secreto-de-meta-de-prueba-456789',
    LINKEDIN_ACCESS_TOKEN: 'secreto-de-linkedin-de-prueba-0',
  };
  const env = {
    ...BASE,
    ...secretos,
    META_PAGE_ID: '123456',
    LINK_VERCEL_TEAM: 'equipo-x',
    LINK_VERCEL_PROJECT: 'proyecto-x',
  };
  const { cuerpo, texto } = await leer(await responderEstado(pedido(TOKEN_ADMIN), env, pedir));
  for (const valor of [...Object.values(secretos), PUBLISHABLE, ADMIN, 'equipo-x', REF]) {
    assert.equal(texto.includes(valor), false, valor);
  }
  const tarjetas = Object.fromEntries(cuerpo.tarjetas.map((x) => [x.id, x]));
  assert.equal(tarjetas['infra.vercel'].estado, 'pendiente');
  assert.equal(tarjetas['infra.vercel'].prompt, 'vercelVision');
  assert.equal(tarjetas['redes.facebook'].estado, 'pendiente');
  assert.equal(tarjetas['redes.instagram'].estado, 'sinConfigurar');
  assert.deepEqual(tarjetas['redes.instagram'].faltan, ['META_IG_USER_ID', 'LINK_INSTAGRAM_URL']);
});

test('una variable con un valor que no sirve es una falla', async () => {
  const { pedir } = authFalso();
  const env = {
    ...BASE,
    ADMIN_USER_IDS: `${ADMIN}, cualquier-cosa`,
    LINK_FACEBOOK_URL: 'http://facebook.com/sin-https',
    META_PAGE_ID: 'no-es-un-numero',
  };
  const { cuerpo } = await leer(await responderEstado(pedido(TOKEN_ADMIN), env, pedir));
  const partes = Object.fromEntries(cuerpo.partes.map((p) => [p.id, p]));
  const tarjetas = Object.fromEntries(cuerpo.tarjetas.map((x) => [x.id, x]));
  assert.equal(partes.ingreso.estado, 'atencion');
  assert.equal(partes.ingreso.motivo, 'adminInvalidos');
  assert.equal(partes.enlaces.estado, 'falla');
  assert.deepEqual(partes.enlaces.invalidas, ['LINK_FACEBOOK_URL']);
  assert.equal(partes.meta.estado, 'falla');
  assert.equal(tarjetas['redes.facebook'].estado, 'falla');
  assert.deepEqual(tarjetas['redes.facebook'].invalidas, ['META_PAGE_ID', 'LINK_FACEBOOK_URL']);
});

test('validaciones de las URLs', () => {
  assert.equal(refDeSupabase(`https://${REF}.supabase.co`), REF);
  assert.equal(refDeSupabase(`https://${REF}.supabase.co/`), REF);
  assert.equal(refDeSupabase(`http://${REF}.supabase.co`), null);
  assert.equal(refDeSupabase(`https://${REF}.supabase.co.example.org`), null);
  assert.equal(refDeSupabase(`https://${REF}.supabase.co/rest/v1`), null);
  assert.equal(refDeSupabase('https://corto.supabase.co'), null);
  assert.equal(
    urlDeVision('https://huggingface.co/spaces/duenio/espacio'),
    'https://huggingface.co/spaces/duenio/espacio',
  );
  assert.equal(urlDeVision('https://duenio-espacio.hf.space'), 'https://duenio-espacio.hf.space/');
  assert.equal(urlDeVision('https://huggingface.co/duenio/modelo'), null);
  // Con usuario y contraseña en la URL (armada en partes para no parecer un email).
  assert.equal(urlDeVision(['https://usuario:clave', 'huggingface.co/spaces/a/b'].join('@')), null);
});

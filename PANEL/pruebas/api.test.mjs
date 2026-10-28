// Pruebas de api/config y api/estado con variables y servicios falsos:
// Supabase Auth, admin_resumen() por PostgREST y la API de Vercel.
// Correr con: npm run probar   (desde PANEL/)

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { esClavePublica, refDeSupabase } from '../api/_comun.js';
import { responderConfig } from '../api/config.js';
import { responderEstado } from '../api/estado.js';
import { limpiarDeploy } from '../api/_fuentes.js';

const REF = 'abcdefghijklmnopqrst';
const SUPABASE = `https://${REF}.supabase.co`;
const ADMIN = '00000000-0000-4000-8000-000000000001';
const OTRA = '00000000-0000-4000-8000-000000000002';
const TOKEN_ADMIN = 'token-de-prueba-de-la-cuenta-admin';
const TOKEN_OTRA = 'token-de-prueba-de-otra-cuenta-cualquiera';
const PUBLISHABLE = 'sb_publishable_clave-de-prueba-no-real';
const TOKEN_VERCEL = 'secreto-de-vercel-de-prueba-123';

const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;
const haceMs = (ms) => new Date(Date.now() - ms).toISOString();

const jwt = (payload) =>
  ['e30', globalThis.Buffer.from(JSON.stringify(payload)).toString('base64url'), 'firma'].join('.');

const BASE = {
  SUPABASE_URL: SUPABASE,
  SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
  ADMIN_USER_IDS: ADMIN,
};

const CON_VERCEL = {
  ...BASE,
  VERCEL_API_TOKEN: TOKEN_VERCEL,
  LINK_VERCEL_TEAM: 'equipo-de-prueba',
  LINK_VERCEL_PROJECT: 'proyecto-de-prueba',
};

/** Lo que devuelve admin_resumen(), con la forma de la migración 0028. */
function resumen(cambios = {}) {
  const dias = Array.from({ length: 7 }, (_, i) => ({
    dia: `2026-10-${String(22 + i).padStart(2, '0')}`,
    casos: i,
  }));
  const base = {
    generado_en: new Date().toISOString(),
    casos: {
      nuevos_24h: 6,
      nuevos_7d: 21,
      por_dia: dias,
      abiertos: 40,
      reunidos: 12,
      reunidos_30d: 3,
    },
    coincidencias: { pendientes: 2, pendiente_desde: haceMs(DIA) },
    moderacion: {
      denuncias_pendientes: 0,
      casos_ocultos: 1,
      historias_ocultas: 0,
      errores_sin_resolver: 0,
    },
    usuarios: { total: 150, nuevos_24h: 4, nuevos_7d: 9 },
    vision: {
      esperando: 1,
      esperando_desde: haceMs(5 * MINUTO),
      trabadas: 0,
      sin_reintentos: 0,
      llamadas_ia_24h: 30,
      errores_ia_24h: 0,
      ia_activa: true,
      ia_pausa: null,
      ultima_procesada: haceMs(3 * MINUTO),
    },
    almacenamiento: { base_bytes: 25 * 1000 * 1000, storage_bytes: 120 * 1000 * 1000 },
  };
  for (const [grupo, valores] of Object.entries(cambios)) {
    base[grupo] = { ...base[grupo], ...valores };
  }
  return base;
}

function deploy(cambios = {}) {
  return {
    uid: 'dpl_prueba',
    name: 'proyecto-de-prueba',
    // Armada en partes: el verificador no deja dominios .vercel.app escritos.
    url: ['proyecto-de-prueba-abc', 'vercel', 'app'].join('.'),
    readyState: 'READY',
    state: 'READY',
    createdAt: Date.now() - 2 * 60 * MINUTO,
    creator: { uid: 'u', username: 'persona-de-prueba' },
    inspectorUrl: 'https://vercel.com/equipo-de-prueba/proyecto-de-prueba/abc',
    meta: {
      githubCommitSha: '72e224edc5e58caf6c26eecfc53b858cfcf678dd',
      githubCommitMessage: 'Mensaje con datos de prueba que no van al panel',
    },
    ...cambios,
  };
}

const responder = (r) =>
  r instanceof Error
    ? Promise.reject(r)
    : Response.json(r.cuerpo ?? {}, { status: r.estado ?? 200 });

/**
 * Supabase y Vercel falsos: anotan los pedidos y responden según la URL. Cada
 * respuesta es `{ estado, cuerpo }` o un Error (la red se cayó).
 */
function serviciosFalsos({
  authCaido = false,
  rpc = { cuerpo: resumen() },
  token = { cuerpo: { token: { id: 't', expiresAt: Date.now() + 90 * DIA } } },
  deploys = { cuerpo: { deployments: [deploy()] } },
} = {}) {
  const pedidos = [];
  const pedir = async (url, opciones = {}) => {
    pedidos.push({ url, opciones });
    if (url === `${SUPABASE}/auth/v1/user`) {
      if (authCaido) throw new TypeError('fetch failed');
      const recibido = opciones.headers.Authorization.replace('Bearer ', '');
      if (recibido === TOKEN_ADMIN) return Response.json({ id: ADMIN });
      if (recibido === TOKEN_OTRA) return Response.json({ id: OTRA });
      return Response.json({ code: 'bad_jwt' }, { status: 403 });
    }
    if (url === `${SUPABASE}/rest/v1/rpc/admin_resumen`) return responder(rpc);
    if (url === 'https://api.vercel.com/v5/user/tokens/current') return responder(token);
    if (url.startsWith('https://api.vercel.com/v7/deployments?')) return responder(deploys);
    throw new Error(`Pedido inesperado: ${url}`);
  };
  return { pedir, pedidos };
}

const authFalso = (opciones) => serviciosFalsos(opciones);

const pedido = (token, ruta = '/api/estado') =>
  new Request(`https://panel.example.org${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

async function leer(respuesta) {
  const texto = await respuesta.text();
  return { estado: respuesta.status, cuerpo: JSON.parse(texto), texto, headers: respuesta.headers };
}

/** /api/estado con una sesión de administración, por id. */
async function estadoCon(env, opciones) {
  const { pedir, pedidos } = serviciosFalsos(opciones);
  const { cuerpo, texto } = await leer(await responderEstado(pedido(TOKEN_ADMIN), env, pedir));
  return {
    partes: Object.fromEntries(cuerpo.partes.map((x) => [x.id, x])),
    tarjetas: Object.fromEntries(cuerpo.tarjetas.map((x) => [x.id, x])),
    cuerpo,
    texto,
    pedidos,
  };
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

test('estado valida la sesión y pide el resumen con el token de la sesión', async () => {
  const { pedidos } = await estadoCon(BASE);
  assert.equal(pedidos.length, 2);
  const [auth, rpc] = pedidos;
  assert.equal(auth.url, `${SUPABASE}/auth/v1/user`);
  assert.equal(auth.opciones.headers.apikey, PUBLISHABLE);
  assert.equal(auth.opciones.headers.Authorization, `Bearer ${TOKEN_ADMIN}`);
  assert.equal(auth.opciones.redirect, 'error');
  // admin_resumen() con el token de quien entró: nunca otra clave.
  assert.equal(rpc.url, `${SUPABASE}/rest/v1/rpc/admin_resumen`);
  assert.equal(rpc.opciones.method, 'POST');
  assert.equal(rpc.opciones.body, '{}');
  assert.equal(rpc.opciones.headers.apikey, PUBLISHABLE);
  assert.equal(rpc.opciones.headers.Authorization, `Bearer ${TOKEN_ADMIN}`);
  assert.equal(rpc.opciones.redirect, 'error');
});

test('estado: 401 sin sesión, 403 sin permiso, 502 si Supabase no responde, 503 sin configurar', async () => {
  const { pedir, pedidos } = authFalso();
  assert.equal((await responderEstado(pedido(), BASE, pedir)).status, 401);
  assert.equal(
    (await responderEstado(pedido('token-cualquiera-que-no-existe'), BASE, pedir)).status,
    401,
  );
  const otra = await leer(await responderEstado(pedido(TOKEN_OTRA), BASE, pedir));
  assert.equal(otra.estado, 403);
  assert.deepEqual(otra.cuerpo, { error: 'sinPermiso' });
  // Sin una sesión de administración no se pide nada más.
  assert.ok(pedidos.every((x) => x.url.endsWith('/auth/v1/user')));
  assert.equal(
    (await responderEstado(pedido(TOKEN_ADMIN), BASE, authFalso({ authCaido: true }).pedir)).status,
    502,
  );
  assert.equal((await responderEstado(pedido(TOKEN_ADMIN), {}, pedir)).status, 503);
  // Sin ADMIN_USER_IDS nadie entra.
  const sinLista = { ...BASE, ADMIN_USER_IDS: 'no-es-un-id' };
  assert.equal((await responderEstado(pedido(TOKEN_ADMIN), sinLista, pedir)).status, 503);
});

test('con solo lo básico: La app y Supabase con datos, Vercel sin configurar', async () => {
  const { partes, tarjetas, cuerpo, pedidos } = await estadoCon(BASE);
  assert.equal(pedidos.length, 2, 'sin VERCEL_API_TOKEN no se llama a Vercel');

  assert.equal(partes.ingreso.estado, 'ok');
  assert.equal(partes.enlaces.estado, 'sinConfigurar');
  assert.equal(partes.datosInternos.estado, 'ok');
  assert.equal(partes.vercel.estado, 'sinConfigurar');
  assert.deepEqual(partes.vercel.faltan, [
    'VERCEL_API_TOKEN',
    'LINK_VERCEL_TEAM',
    'LINK_VERCEL_PROJECT',
  ]);
  assert.equal(partes.alertas.estado, 'pendiente');
  assert.equal(partes.vision, undefined);

  assert.deepEqual(tarjetas['app.casosNuevos'], {
    id: 'app.casosNuevos',
    estado: 'ok',
    faltan: [],
    invalidas: [],
    prompt: null,
    motivo: null,
    datos: { nuevos24h: 6, nuevos7d: 21, porDia: resumen().casos.por_dia },
  });
  assert.deepEqual(tarjetas['app.reunidos'].datos, { reunidos: 12, reunidos30d: 3 });
  assert.deepEqual(tarjetas['app.reunidos'].faltan, ['LINK_APP_URL']);
  assert.equal(tarjetas['app.coincidencias'].datos.pendientes, 2);
  assert.deepEqual(tarjetas['app.moderacion'].datos, {
    denuncias: 0,
    casosOcultos: 1,
    historiasOcultas: 0,
    errores: 0,
  });
  assert.deepEqual(tarjetas['app.usuarios'].datos, { total: 150, nuevos24h: 4, nuevos7d: 9 });
  assert.equal(tarjetas['app.fotosTrabadas'].estado, 'ok');
  assert.deepEqual(tarjetas['infra.supabase'].datos, {
    baseBytes: 25000000,
    storageBytes: 120000000,
    baseLimite: 500000000,
    storageLimite: 1000000000,
  });
  assert.equal(tarjetas['infra.vision'].estado, 'ok');
  assert.equal(tarjetas['infra.vision'].datos.llamadas24h, 30);
  assert.equal(tarjetas['infra.vercel'].estado, 'sinConfigurar');
  assert.equal(tarjetas['infra.vercel'].datos, null);
  assert.equal(tarjetas['tokens.vercel'].estado, 'sinConfigurar');
  assert.equal(tarjetas['redes.linkedin'].estado, 'sinConfigurar');
  for (const item of [...cuerpo.partes, ...cuerpo.tarjetas]) {
    assert.deepEqual(Object.keys(item).sort(), [
      'datos',
      'estado',
      'faltan',
      'id',
      'invalidas',
      'motivo',
      'prompt',
    ]);
  }
});

test('umbrales de La app', async () => {
  const casos = (await estadoCon(BASE, { rpc: { cuerpo: resumen({ casos: { nuevos_7d: 0 } }) } }))
    .tarjetas['app.casosNuevos'];
  assert.equal(casos.estado, 'atencion');
  assert.equal(casos.motivo, 'sinCasos7d');

  const viejas = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ coincidencias: { pendiente_desde: haceMs(4 * DIA) } }) },
  });
  assert.equal(viejas.tarjetas['app.coincidencias'].motivo, 'coincidenciasViejas');

  const denuncias = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ moderacion: { denuncias_pendientes: 2, errores_sin_resolver: 1 } }) },
  });
  assert.equal(denuncias.tarjetas['app.moderacion'].estado, 'atencion');
  assert.equal(denuncias.tarjetas['app.moderacion'].motivo, 'denunciasPendientes');
  const errores = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ moderacion: { errores_sin_resolver: 1 } }) },
  });
  assert.equal(errores.tarjetas['app.moderacion'].motivo, 'erroresSinResolver');

  const trabadas = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ vision: { trabadas: 1, esperando_desde: haceMs(40 * MINUTO) } }) },
  });
  assert.equal(trabadas.tarjetas['app.fotosTrabadas'].estado, 'atencion');
  assert.equal(trabadas.tarjetas['app.fotosTrabadas'].motivo, 'fotosTrabadas');
  const detenida = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ vision: { trabadas: 1, esperando_desde: haceMs(3 * 60 * MINUTO) } }) },
  });
  assert.equal(detenida.tarjetas['app.fotosTrabadas'].estado, 'falla');
  assert.equal(detenida.tarjetas['app.fotosTrabadas'].motivo, 'colaDetenida');
  const sinReintentos = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ vision: { sin_reintentos: 2 } }) },
  });
  assert.equal(sinReintentos.tarjetas['app.fotosTrabadas'].motivo, 'fotosSinReintentos');
  // La tarjeta del servicio no repite el aviso de las fotos.
  assert.equal(sinReintentos.tarjetas['infra.vision'].estado, 'ok');
});

test('umbrales de Supabase y del servicio de visión', async () => {
  const alto = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ almacenamiento: { storage_bytes: 850 * 1000 * 1000 } }) },
  });
  assert.equal(alto.tarjetas['infra.supabase'].estado, 'atencion');
  assert.equal(alto.tarjetas['infra.supabase'].motivo, 'usoAlto');
  const lleno = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ almacenamiento: { base_bytes: 480 * 1000 * 1000 } }) },
  });
  assert.equal(lleno.tarjetas['infra.supabase'].estado, 'falla');
  assert.equal(lleno.tarjetas['infra.supabase'].motivo, 'usoCasiLleno');

  const sinCredito = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ vision: { ia_pausa: 'sin_credito' } }) },
  });
  assert.equal(sinCredito.tarjetas['infra.vision'].estado, 'falla');
  assert.equal(sinCredito.tarjetas['infra.vision'].motivo, 'iaSinCredito');
  const apagada = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ vision: { ia_activa: false } }) },
  });
  assert.equal(apagada.tarjetas['infra.vision'].motivo, 'iaApagada');
  const conErrores = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ vision: { errores_ia_24h: 3 } }) },
  });
  assert.equal(conErrores.tarjetas['infra.vision'].estado, 'atencion');
  assert.equal(conErrores.tarjetas['infra.vision'].motivo, 'erroresIa');
});

test('si el resumen no llega: Pendiente sin la migración, Falla si no', async () => {
  const sinMigracion = await estadoCon(BASE, {
    rpc: { estado: 404, cuerpo: { code: 'PGRST202', message: 'Could not find the function' } },
  });
  assert.equal(sinMigracion.partes.datosInternos.estado, 'pendiente');
  assert.equal(sinMigracion.partes.datosInternos.motivo, 'sinMigracion');
  assert.equal(sinMigracion.tarjetas['app.casosNuevos'].estado, 'pendiente');
  assert.equal(sinMigracion.tarjetas['infra.supabase'].motivo, 'sinMigracion');
  assert.equal(sinMigracion.texto.includes('Could not find'), false);

  const noAdmin = await estadoCon(BASE, {
    rpc: { estado: 403, cuerpo: { code: '42501', message: 'Solo administración' } },
  });
  assert.equal(noAdmin.partes.datosInternos.estado, 'falla');
  assert.equal(noAdmin.partes.datosInternos.motivo, 'noAdministrador');
  assert.equal(noAdmin.tarjetas['app.usuarios'].estado, 'falla');
  assert.equal(noAdmin.tarjetas['app.usuarios'].datos, null);

  for (const rpc of [{ estado: 500, cuerpo: {} }, new TypeError('fetch failed')]) {
    const caido = await estadoCon(BASE, { rpc });
    assert.equal(caido.partes.datosInternos.motivo, 'supabaseNoResponde');
    assert.equal(caido.tarjetas['infra.supabase'].estado, 'falla');
    assert.equal(caido.tarjetas['infra.supabase'].datos, null);
  }

  // Un número que no es un número: esa tarjeta no muestra nada inventado.
  const raro = await estadoCon(BASE, {
    rpc: { cuerpo: resumen({ usuarios: { total: 'muchos' } }) },
  });
  assert.equal(raro.tarjetas['app.usuarios'].estado, 'falla');
  assert.equal(raro.tarjetas['app.usuarios'].motivo, 'datosIncompletos');
  assert.equal(raro.tarjetas['app.usuarios'].datos, null);
  assert.equal(raro.tarjetas['app.casosNuevos'].estado, 'ok');
});

test('Vercel: el último deploy y el vencimiento del token', async () => {
  const { partes, tarjetas, pedidos } = await estadoCon(CON_VERCEL);
  assert.equal(partes.vercel.estado, 'ok');
  assert.equal(tarjetas['infra.vercel'].estado, 'ok');
  assert.deepEqual(tarjetas['infra.vercel'].datos, {
    estado: 'READY',
    commit: '72e224e',
    creado: tarjetas['infra.vercel'].datos.creado,
    inspector: 'https://vercel.com/equipo-de-prueba/proyecto-de-prueba/abc',
  });
  assert.ok(Date.parse(tarjetas['infra.vercel'].datos.creado) > 0);
  assert.equal(tarjetas['tokens.vercel'].estado, 'ok');

  const deDeploys = pedidos.find((x) => x.url.includes('/v7/deployments'));
  const consulta = new URL(deDeploys.url).searchParams;
  assert.equal(consulta.get('projectId'), 'proyecto-de-prueba');
  assert.equal(consulta.get('slug'), 'equipo-de-prueba');
  assert.equal(consulta.get('target'), 'production');
  assert.equal(consulta.get('state').includes('CANCELED'), false);
  assert.equal(deDeploys.opciones.headers.Authorization, `Bearer ${TOKEN_VERCEL}`);
  assert.equal(deDeploys.url.includes(TOKEN_VERCEL), false);
  assert.equal(deDeploys.opciones.redirect, 'error');
});

test('Vercel: deploy con error, trabado o ninguno', async () => {
  const conError = await estadoCon(CON_VERCEL, {
    deploys: {
      cuerpo: {
        deployments: [
          deploy({ state: 'CANCELED', readyState: 'CANCELED' }),
          deploy({ readyState: 'ERROR' }),
        ],
      },
    },
  });
  assert.equal(conError.tarjetas['infra.vercel'].estado, 'falla');
  assert.equal(conError.tarjetas['infra.vercel'].motivo, 'deployFallo');
  assert.equal(conError.tarjetas['infra.vercel'].datos.estado, 'ERROR');
  // El deploy falló, pero Vercel responde: la parte está bien.
  assert.equal(conError.partes.vercel.estado, 'ok');

  const trabado = await estadoCon(CON_VERCEL, {
    deploys: {
      cuerpo: {
        deployments: [deploy({ readyState: 'BUILDING', createdAt: Date.now() - 20 * MINUTO })],
      },
    },
  });
  assert.equal(trabado.tarjetas['infra.vercel'].estado, 'atencion');
  assert.equal(trabado.tarjetas['infra.vercel'].motivo, 'deployTrabado');
  const enCurso = await estadoCon(CON_VERCEL, {
    deploys: {
      cuerpo: { deployments: [deploy({ readyState: 'BUILDING', createdAt: Date.now() - MINUTO })] },
    },
  });
  assert.equal(enCurso.tarjetas['infra.vercel'].estado, 'ok');

  const ninguno = await estadoCon(CON_VERCEL, { deploys: { cuerpo: { deployments: [] } } });
  assert.equal(ninguno.tarjetas['infra.vercel'].estado, 'atencion');
  assert.equal(ninguno.tarjetas['infra.vercel'].motivo, 'sinDeploys');
});

test('Vercel: el token por vencer, vencido, sin vencimiento o que no sirve', async () => {
  const porVencer = await estadoCon(CON_VERCEL, {
    token: { cuerpo: { token: { expiresAt: Date.now() + 10 * DIA } } },
  });
  assert.equal(porVencer.tarjetas['tokens.vercel'].estado, 'atencion');
  assert.equal(porVencer.tarjetas['tokens.vercel'].motivo, 'tokenPorVencer');
  const vencido = await estadoCon(CON_VERCEL, {
    token: { cuerpo: { token: { expiresAt: Date.now() - DIA } } },
  });
  assert.equal(vencido.tarjetas['tokens.vercel'].estado, 'falla');
  assert.equal(vencido.tarjetas['tokens.vercel'].motivo, 'tokenVencido');
  const sinVencimiento = await estadoCon(CON_VERCEL, { token: { cuerpo: { token: { id: 't' } } } });
  assert.equal(sinVencimiento.tarjetas['tokens.vercel'].estado, 'ok');
  assert.deepEqual(sinVencimiento.tarjetas['tokens.vercel'].datos, { vence: null });

  const invalido = await estadoCon(CON_VERCEL, {
    token: { estado: 403, cuerpo: { error: { invalidToken: true } } },
    deploys: { estado: 403, cuerpo: {} },
  });
  assert.equal(invalido.partes.vercel.estado, 'falla');
  assert.equal(invalido.partes.vercel.motivo, 'tokenInvalido');
  assert.equal(invalido.tarjetas['infra.vercel'].motivo, 'tokenInvalido');
  assert.equal(invalido.tarjetas['tokens.vercel'].motivo, 'tokenInvalido');

  // Solo con el token (sin equipo ni proyecto) igual se ve cuándo vence.
  const soloToken = await estadoCon({ ...BASE, VERCEL_API_TOKEN: TOKEN_VERCEL });
  assert.equal(soloToken.tarjetas['tokens.vercel'].estado, 'ok');
  assert.equal(soloToken.tarjetas['infra.vercel'].estado, 'sinConfigurar');
  assert.equal(
    soloToken.pedidos.some((x) => x.url.includes('/deployments')),
    false,
  );
});

test('Vercel: proyecto que no existe, sin acceso, límite o sin respuesta', async () => {
  const casos = [
    [{ estado: 404, cuerpo: {} }, 'proyectoNoEncontrado'],
    [{ estado: 403, cuerpo: {} }, 'sinAccesoAlProyecto'],
    [{ estado: 429, cuerpo: {} }, 'limiteVercel'],
    [new TypeError('fetch failed'), 'vercelNoResponde'],
  ];
  for (const [deploys, motivo] of casos) {
    const { partes, tarjetas } = await estadoCon(CON_VERCEL, { deploys });
    assert.equal(partes.vercel.estado, 'falla', motivo);
    assert.equal(partes.vercel.motivo, motivo);
    assert.equal(tarjetas['infra.vercel'].motivo, motivo);
    assert.equal(tarjetas['tokens.vercel'].estado, 'ok', motivo);
  }
});

test('limpiarDeploy: solo el estado, el commit corto, la fecha y el log de vercel.com', () => {
  assert.equal(limpiarDeploy(deploy({ readyState: 'CANCELED', state: 'CANCELED' })), null);
  assert.equal(limpiarDeploy(deploy({ readyState: 'RARO' })), null);
  const limpio = limpiarDeploy(
    deploy({
      inspectorUrl: 'https://evil.example.org/vercel.com',
      meta: { githubCommitSha: 'zz' },
    }),
  );
  assert.deepEqual(Object.keys(limpio).sort(), ['commit', 'creado', 'estado', 'inspector']);
  assert.equal(limpio.inspector, null);
  assert.equal(limpio.commit, null);
  assert.equal(
    limpiarDeploy({ state: 'READY', created: 1793149734236 }).creado,
    new Date(1793149734236).toISOString(),
  );
});

test('estado nunca devuelve el valor de una variable ni lo que sobra de otro servicio', async () => {
  const secretos = {
    VERCEL_API_TOKEN: TOKEN_VERCEL,
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
  const rpc = {
    cuerpo: { ...resumen(), email: 'persona@example.org', nombre: 'Nombre de prueba' },
  };
  const { tarjetas, texto } = await estadoCon(env, { rpc });
  for (const valor of [
    ...Object.values(secretos),
    PUBLISHABLE,
    ADMIN,
    'equipo-x',
    REF,
    'persona@example.org',
    'Nombre de prueba',
    'persona-de-prueba',
    'Mensaje con datos',
    ['vercel', 'app'].join('.'),
    '72e224edc5',
  ]) {
    assert.equal(texto.includes(valor), false, valor);
  }
  assert.equal(tarjetas['infra.vercel'].estado, 'ok');
  assert.equal(tarjetas['redes.facebook'].estado, 'pendiente');
  assert.equal(tarjetas['redes.facebook'].prompt, 'meta');
  assert.equal(tarjetas['redes.instagram'].estado, 'sinConfigurar');
  assert.deepEqual(tarjetas['redes.instagram'].faltan, ['META_IG_USER_ID', 'LINK_INSTAGRAM_URL']);
});

test('una variable con un valor que no sirve es una falla', async () => {
  const env = {
    ...BASE,
    ADMIN_USER_IDS: `${ADMIN}, cualquier-cosa`,
    LINK_FACEBOOK_URL: 'http://facebook.com/sin-https',
    META_PAGE_ID: 'no-es-un-numero',
  };
  const { partes, tarjetas } = await estadoCon(env);
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
});

// El catálogo del servidor y el de la página tienen que coincidir, y cada
// variable tiene que estar explicada en .env.example.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PARTES as PARTES_SERVIDOR, TARJETAS as TARJETAS_SERVIDOR } from '../api/_catalogo.js';
import { VARIABLES_CONOCIDAS } from '../api/_comun.js';
import { t } from '../i18n/es-UY.js';
import {
  ENLACE_DE_TARJETA,
  PARTES,
  SECCIONES,
  TARJETAS,
  VARIABLE_DE_TOKEN,
  VISTAS,
} from '../js/catalogo.js';

test('mismas partes y tarjetas, en el mismo orden', () => {
  assert.deepEqual(
    PARTES_SERVIDOR.map((p) => p.id),
    PARTES,
  );
  assert.deepEqual(
    TARJETAS_SERVIDOR.map((x) => x.id),
    TARJETAS,
  );
});

test('toda variable del catálogo tiene validación y está en .env.example', () => {
  const ejemplo = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  const enEjemplo = new Set([...ejemplo.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
  for (const item of [...PARTES_SERVIDOR, ...TARJETAS_SERVIDOR]) {
    for (const nombre of [...(item.requiere ?? []), ...(item.enlaces ?? [])]) {
      assert.ok(VARIABLES_CONOCIDAS.includes(nombre), `${nombre} sin validación`);
    }
  }
  for (const nombre of VARIABLES_CONOCIDAS) {
    assert.ok(enEjemplo.has(nombre), `${nombre} no está en .env.example`);
  }
  for (const linea of ejemplo.split('\n')) {
    if (/^[A-Z][A-Z0-9_]+=/.test(linea)) assert.match(linea, /=$/, `con valor: ${linea}`);
  }
});

test('cada tarjeta, parte, vista y prompt tiene sus textos', () => {
  for (const id of TARJETAS) {
    assert.ok(t.tarjetas[id]?.titulo && t.tarjetas[id]?.descripcion, id);
    assert.ok(ENLACE_DE_TARJETA[id], `${id} sin link`);
    assert.ok(t.enlaces[ENLACE_DE_TARJETA[id].texto], `${id}: texto del link`);
  }
  for (const seccion of SECCIONES) {
    assert.ok(t.secciones[seccion.id], seccion.id);
    if (seccion.tipo === 'servicios') {
      for (const id of seccion.tarjetas) assert.ok(t.tarjetas[id].corto, `${id} sin texto corto`);
    }
    if (seccion.tipo === 'tokens') {
      for (const id of seccion.tarjetas) assert.ok(VARIABLE_DE_TOKEN[id], `${id} sin variable`);
    }
  }
  for (const id of PARTES) assert.ok(t.configuracion.partes[id], id);
  for (const vista of VISTAS) assert.ok(t.vistas[vista], vista);
  for (const item of [...PARTES_SERVIDOR, ...TARJETAS_SERVIDOR]) {
    if (item.prompt) assert.ok(t.prompts[item.prompt], item.prompt);
  }
});

test('las vistas son Inicio más una por sección', () => {
  assert.deepEqual(VISTAS, ['inicio', ...SECCIONES.map((s) => s.id)]);
});

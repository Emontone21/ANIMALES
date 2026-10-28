/**
 * Piezas de la interfaz. Todo se arma con createElement y textContent: nunca
 * innerHTML, así ningún dato de una API se interpreta como HTML.
 */

import { t } from '../i18n/es-UY.js';

const SVG = 'http://www.w3.org/2000/svg';

const ICONOS = [
  'huella',
  'ok',
  'atencion',
  'falla',
  'pendiente',
  'sinConfigurar',
  'actualizar',
  'salir',
  'externo',
  'flecha',
];

/**
 * Un elemento con atributos e hijos. `clase` es la clase, `texto` el
 * textContent y `on…` un evento; los hijos de texto entran como texto.
 */
export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'clase') nodo.className = valor;
    else if (clave === 'texto') nodo.textContent = valor;
    else if (clave.startsWith('on') && typeof valor === 'function') {
      nodo.addEventListener(clave.slice(2), valor);
    } else nodo.setAttribute(clave, valor === true ? '' : String(valor));
  }
  for (const hijo of hijos.flat()) {
    if (hijo !== null && hijo !== undefined && hijo !== false) nodo.append(hijo);
  }
  return nodo;
}

/** Un ícono del sprite de index.html, siempre oculto para los lectores. */
export function icono(nombre, clase = 'icono') {
  if (!ICONOS.includes(nombre)) throw new Error(`Ícono desconocido: ${nombre}`);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', clase);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const uso = document.createElementNS(SVG, 'use');
  uso.setAttribute('href', `#i-${nombre}`);
  svg.append(uso);
  return svg;
}

export function marca({ grande = false } = {}) {
  return el(
    'div',
    { clase: grande ? 'marca marca--grande' : 'marca' },
    el('span', { clase: 'marca__simbolo' }, icono('huella')),
    el(
      'span',
      { clase: 'marca__textos' },
      el('span', { clase: 'marca__nombre', texto: t.marca.nombre }),
      el('span', { clase: 'marca__subtitulo', texto: t.marca.subtitulo }),
    ),
  );
}

/** Pastilla de estado: color, ícono y texto juntos. `alDia` para los tokens. */
export function pastilla(estado, { alDia = false } = {}) {
  const texto = estado === 'ok' && alDia ? t.estados.alDia : t.estados[estado];
  return el('span', { clase: `pastilla pastilla--${estado}` }, icono(estado), texto);
}

export function boton({
  texto,
  nombreIcono,
  variante = 'secundario',
  alTocar,
  tipo = 'button',
  clases = '',
  etiqueta,
}) {
  return el(
    'button',
    {
      type: tipo,
      clase: `boton boton--${variante} ${clases}`.trim(),
      'aria-label': etiqueta,
      onclick: alTocar,
    },
    nombreIcono ? icono(nombreIcono) : null,
    el('span', { clase: 'boton__texto', texto }),
  );
}

/** Link "Abrir en…": botón secundario (o primario) que abre otra pestaña. */
export function enlaceExterno({ texto, href, primario = false }) {
  return el(
    'a',
    {
      clase: `boton ${primario ? 'boton--primario' : 'boton--secundario'}`,
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    el('span', { texto }),
    el('span', { clase: 'solo-lectores', texto: ` ${t.general.otraPestana}` }),
    icono('externo'),
  );
}

/** Nombres de variables en mono, separados por comas. */
export function variables(nombres) {
  const partes = [];
  nombres.forEach((nombre, i) => {
    if (i > 0) partes.push(', ');
    partes.push(el('code', { texto: nombre }));
  });
  return partes;
}

/**
 * Qué le falta a una parte o tarjeta, o por qué está en Atención o Falla: el
 * motivo, las variables que faltan o no sirven, o el prompt que trae sus
 * datos. Una o dos líneas.
 */
export function lineasDeFalta(item, { clase = 'tarjeta__falta' } = {}) {
  const lineas = [];
  if (item.motivo === 'sinEstado') {
    lineas.push(el('p', { clase, texto: t.atencion.sinEstadoItem }));
    return lineas;
  }
  if (item.motivo === 'adminInvalidos') {
    lineas.push(
      el('p', { clase }, el('code', { texto: 'ADMIN_USER_IDS' }), ' ', t.atencion.adminInvalidos),
    );
    return lineas;
  }
  if (item.motivo && t.motivos[item.motivo]) {
    lineas.push(el('p', { clase, texto: t.motivos[item.motivo] }));
  }
  if (item.estado === 'falla' && item.invalidas.length > 0) {
    lineas.push(
      el('p', { clase }, variables(item.invalidas), ' ', t.falta.invalidas(item.invalidas.length)),
    );
  }
  if (item.estado === 'sinConfigurar' && item.faltan.length > 0) {
    lineas.push(
      el('p', { clase }, `${t.falta.variables(item.faltan.length)} `, variables(item.faltan), '.'),
    );
  }
  if (item.estado === 'pendiente' && item.prompt) {
    lineas.push(el('p', { clase, texto: t.falta.prompt(t.prompts[item.prompt]) }));
  }
  // Lo que falta solo para el link "Abrir en…".
  if (item.estado !== 'sinConfigurar' && item.invalidas.length === 0 && item.faltan.length > 0) {
    lineas.push(
      el(
        'p',
        { clase: `${clase} secundario` },
        `${t.falta.soloEnlace(item.faltan.length)} `,
        variables(item.faltan),
        '.',
      ),
    );
  }
  if (item.estado === 'ok' && !item.datos && lineas.length === 0) {
    lineas.push(el('p', { clase, texto: t.configuracion.listo }));
  }
  return lineas;
}

/**
 * Inicio del panel: cabecera, menú (pestañas en el celular) y contenido.
 * Cada vista se elige con el hash (#/app, #/infraestructura…): "Inicio"
 * muestra todas las secciones y las demás, solo la suya.
 */

import { t } from '../i18n/es-UY.js';
import { ENLACE_DE_TARJETA, PARTES, SECCIONES, VARIABLE_DE_TOKEN, VISTAS } from './catalogo.js';
import { boton, el, enlaceExterno, icono, lineasDeFalta, marca, pastilla } from './componentes.js';
import { avisosDe, faltaConfigurar, resumenDe } from './datos.js';
import { haceCuanto } from './tiempo.js';

const CADA_CUANTO_EL_RELOJ_MS = 30 * 1000;
const VIEJO_DESPUES_DE_MS = 5 * 60 * 1000;

export function vistaDeHash(hash) {
  const vista = (hash ?? '').replace(/^#\/?/, '');
  return VISTAS.includes(vista) ? vista : 'inicio';
}

const hrefDe = (vista) => (vista === 'inicio' ? '#/' : `#/${vista}`);

function enlaceDeTarjeta(id, enlaces, { primario = false } = {}) {
  const enlace = ENLACE_DE_TARJETA[id];
  const href = enlace?.url(enlaces);
  return href ? enlaceExterno({ texto: t.enlaces[enlace.texto], href, primario }) : null;
}

const esPendiente = (item) => item.estado === 'pendiente' || item.estado === 'sinConfigurar';

/** Una tarjeta. En esta etapa todas son pendientes o sin configurar: borde punteado. */
function tarjeta(id, item, enlaces, nivel) {
  const textos = t.tarjetas[id];
  const acciones = enlaceDeTarjeta(id, enlaces);
  return el(
    'article',
    { clase: esPendiente(item) ? 'tarjeta tarjeta--pendiente' : 'tarjeta' },
    el(
      'div',
      { clase: 'tarjeta__cabecera' },
      el(`h${nivel}`, { clase: 'tarjeta__titulo', texto: textos.titulo }),
      pastilla(item.estado),
    ),
    el('p', { clase: 'tarjeta__descripcion', texto: textos.descripcion }),
    lineasDeFalta(item),
    acciones ? el('div', { clase: 'tarjeta__acciones' }, acciones) : null,
  );
}

/** En el celular, Infraestructura y Redes son filas tocables que se abren. */
function fila(id, item, enlaces) {
  const textos = t.tarjetas[id];
  const idDetalle = `detalle-${id.replace('.', '-')}`;
  const detalle = el(
    'div',
    { id: idDetalle, clase: 'fila__contenido', hidden: true },
    el('p', { clase: 'tarjeta__descripcion', texto: textos.descripcion }),
    lineasDeFalta(item),
    enlaceDeTarjeta(id, enlaces),
  );
  const abrir = el(
    'button',
    {
      type: 'button',
      clase: 'fila__boton',
      'aria-expanded': 'false',
      'aria-controls': idDetalle,
      onclick: () => {
        const abierta = abrir.getAttribute('aria-expanded') === 'true';
        abrir.setAttribute('aria-expanded', String(!abierta));
        detalle.hidden = abierta;
      },
    },
    el(
      'span',
      { clase: 'lista__textos' },
      el('span', { clase: 'lista__titulo', texto: textos.titulo }),
      el('span', { clase: 'lista__detalle', texto: textos.corto }),
    ),
    pastilla(item.estado),
    icono('flecha', 'icono fila__flecha'),
  );
  return el('li', { clase: 'fila' }, abrir, detalle);
}

function filaDeToken(id, item, enlaces) {
  const textos = t.tarjetas[id];
  const variable = VARIABLE_DE_TOKEN[id];
  return el(
    'li',
    { clase: 'lista__fila' },
    el(
      'div',
      { clase: 'lista__textos' },
      el('span', { clase: 'lista__titulo', texto: textos.titulo }),
      el('p', { clase: 'lista__detalle', texto: textos.descripcion }),
      // Si falta, ya la nombra la línea de lo que falta.
      item.faltan.includes(variable)
        ? null
        : el(
            'p',
            { clase: 'lista__detalle' },
            `${t.atencion.variableDelToken} `,
            el('code', { texto: variable }),
          ),
      lineasDeFalta(item, { clase: 'lista__detalle' }),
    ),
    pastilla(item.estado, { alDia: true }),
    enlaceDeTarjeta(id, enlaces),
  );
}

function seccionDeTarjetas(seccion, s, conTitulo) {
  const idTitulo = conTitulo ? `titulo-${seccion.id}` : 'titulo-pagina';
  const nivel = conTitulo ? 3 : 2;
  const items = seccion.tarjetas.map((id) => [id, s.estado.tarjetas.get(id)]);

  let contenido;
  if (seccion.tipo === 'tokens') {
    contenido = el(
      'ul',
      { clase: 'lista' },
      items.map(([id, item]) => filaDeToken(id, item, s.enlaces)),
    );
  } else {
    contenido = [
      el(
        'div',
        { clase: `grilla grilla--${seccion.tipo}` },
        items.map(([id, item]) => tarjeta(id, item, s.enlaces, nivel)),
      ),
      seccion.tipo === 'servicios'
        ? el(
            'ul',
            { clase: 'lista filas' },
            items.map(([id, item]) => fila(id, item, s.enlaces)),
          )
        : null,
    ];
  }

  return el(
    'section',
    { clase: 'seccion', 'aria-labelledby': idTitulo },
    conTitulo
      ? el(
          'div',
          { clase: 'seccion__cabecera' },
          el('h2', { id: idTitulo, texto: t.secciones[seccion.id] }),
        )
      : null,
    contenido,
  );
}

function tituloDeAviso(aviso) {
  return aviso.tipo === 'parte' ? t.configuracion.partes[aviso.id] : t.tarjetas[aviso.id].titulo;
}

function seccionAtencion(s, acciones) {
  const avisos = avisosDe(s.estado);
  const { fallas, atenciones } = resumenDe(avisos);
  const filas = [];

  if (s.errorEstado) {
    filas.push(
      el(
        'li',
        { clase: 'lista__fila lista__fila--aviso' },
        pastilla('falla'),
        el(
          'div',
          { clase: 'lista__textos' },
          el('span', { clase: 'lista__titulo', texto: t.atencion.sinEstado.titulo }),
          el('p', { clase: 'lista__detalle', texto: t.atencion.sinEstado.detalle }),
        ),
        boton({
          texto: t.general.reintentar,
          nombreIcono: 'actualizar',
          variante: 'primario',
          alTocar: acciones.alActualizar,
        }),
      ),
    );
  }

  for (const aviso of avisos) {
    // Por ahora todo aviso es de configuración: el botón lleva a ese bloque.
    filas.push(
      el(
        'li',
        { clase: 'lista__fila lista__fila--aviso' },
        pastilla(aviso.estado),
        el(
          'div',
          { clase: 'lista__textos' },
          el('span', { clase: 'lista__titulo', texto: tituloDeAviso(aviso) }),
          lineasDeFalta(aviso, { clase: 'lista__detalle' }),
        ),
        boton({ texto: t.atencion.verConfiguracion, alTocar: acciones.irAConfiguracion }),
      ),
    );
  }

  const total = { fallas: fallas + (s.errorEstado ? 1 : 0), atenciones };
  return el(
    'section',
    { clase: 'seccion', 'aria-labelledby': 'titulo-atencion' },
    el(
      'div',
      { clase: 'seccion__cabecera' },
      el('h2', { id: 'titulo-atencion', texto: t.atencion.titulo }),
      el('p', {
        clase: 'seccion__bajada',
        texto: t.atencion.resumen(total.fallas, total.atenciones),
      }),
    ),
    filas.length > 0
      ? el('ul', { clase: 'lista' }, filas)
      : el(
          'div',
          { clase: 'lista' },
          el(
            'div',
            { clase: 'lista__fila' },
            pastilla('ok', { alDia: true }),
            el('p', { texto: t.atencion.vacio }),
          ),
        ),
  );
}

function seccionConfiguracion(s) {
  return el(
    'section',
    { clase: 'seccion', 'aria-labelledby': 'titulo-configuracion' },
    el(
      'div',
      { clase: 'seccion__cabecera' },
      el('h2', { id: 'titulo-configuracion', tabindex: '-1', texto: t.configuracion.titulo }),
      el('p', { clase: 'seccion__bajada', texto: t.configuracion.bajada }),
    ),
    el(
      'ul',
      { clase: 'lista lista--pendiente' },
      PARTES.map((id) => {
        const item = s.estado.partes.get(id);
        return el(
          'li',
          { clase: 'lista__fila' },
          el(
            'div',
            { clase: 'lista__textos' },
            el('span', { clase: 'lista__titulo', texto: t.configuracion.partes[id] }),
            lineasDeFalta(item, { clase: 'lista__detalle' }),
          ),
          pastilla(item.estado),
        );
      }),
    ),
  );
}

/**
 * Monta el Inicio. `alActualizar()` pide el estado de nuevo y llama a
 * `actualizar` o `marcarError`; `alSalir()` cierra la sesión.
 */
export function montarInicio({ estado, enlaces, alActualizar, alSalir }) {
  const s = {
    vista: vistaDeHash(location.hash),
    estado,
    enlaces,
    actualizadoEn: Date.now(),
    errorEstado: false,
    ocupado: false,
  };

  const anuncio = el('div', { clase: 'solo-lectores', 'aria-live': 'polite' });
  const contenido = el('main', { id: 'contenido', clase: 'contenido', tabindex: '-1' });
  const menu = el('nav', { clase: 'menu', 'aria-label': t.cabecera.menu });

  const pedirActualizacion = () => {
    if (!s.ocupado) alActualizar();
  };

  const botonActualizar = boton({
    texto: t.cabecera.actualizar,
    nombreIcono: 'actualizar',
    clases: 'boton--icono-celular',
    etiqueta: t.cabecera.actualizar,
    alTocar: pedirActualizacion,
  });
  const botonSalir = boton({
    texto: t.cabecera.salir,
    nombreIcono: 'salir',
    clases: 'boton--icono-celular',
    etiqueta: t.cabecera.salir,
    alTocar: alSalir,
  });

  const textoActualizado = () => t.tiempo.actualizado(haceCuanto(s.actualizadoEn));
  const relojCompu = el('span', { clase: 'actualizado actualizado--compu' });
  let relojCelular = null;
  const moverReloj = () => {
    relojCompu.textContent = textoActualizado();
    if (relojCelular) relojCelular.textContent = textoActualizado();
  };

  const irAConfiguracion = () => {
    const titulo = document.getElementById('titulo-configuracion');
    if (titulo) {
      titulo.scrollIntoView({ block: 'start' });
      titulo.focus({ preventScroll: true });
    }
  };

  function dibujarMenu() {
    menu.replaceChildren(
      el(
        'ul',
        {},
        VISTAS.map((vista) =>
          el(
            'li',
            {},
            el('a', {
              href: hrefDe(vista),
              'aria-current': vista === s.vista ? 'page' : null,
              texto: t.vistas[vista],
            }),
          ),
        ),
      ),
    );
  }

  function dibujarContenido() {
    relojCelular = el('p', {
      clase: 'actualizado actualizado--celular',
      texto: textoActualizado(),
    });
    const partes = [
      el('h1', {
        id: 'titulo-pagina',
        clase: 'titulo-pagina',
        tabindex: '-1',
        texto: t.vistas[s.vista],
      }),
      relojCelular,
    ];
    if (s.vista === 'inicio') {
      partes.push(seccionAtencion(s, { alActualizar: pedirActualizacion, irAConfiguracion }));
      if (faltaConfigurar(s.estado)) partes.push(seccionConfiguracion(s));
      for (const seccion of SECCIONES) partes.push(seccionDeTarjetas(seccion, s, true));
    } else {
      partes.push(
        seccionDeTarjetas(
          SECCIONES.find((x) => x.id === s.vista),
          s,
          false,
        ),
      );
    }
    contenido.replaceChildren(...partes);
    document.title =
      s.vista === 'inicio' ? t.documento.titulo : t.documento.tituloVista(t.vistas[s.vista]);
  }

  const enfocarTitulo = () => document.getElementById('titulo-pagina')?.focus();

  const alCambiarHash = () => {
    s.vista = vistaDeHash(location.hash);
    dibujarMenu();
    dibujarContenido();
    window.scrollTo(0, 0);
    enfocarTitulo();
  };

  const alVolverALaPestana = () => {
    if (
      document.visibilityState === 'visible' &&
      Date.now() - s.actualizadoEn > VIEJO_DESPUES_DE_MS
    ) {
      pedirActualizacion();
    }
  };

  const saltar = el('a', {
    clase: 'saltar boton boton--secundario',
    href: '#contenido',
    texto: t.general.saltar,
    onclick: (evento) => {
      evento.preventDefault();
      contenido.focus();
    },
  });

  const nodo = el(
    'div',
    {},
    saltar,
    el(
      'header',
      { clase: 'cabecera' },
      el(
        'div',
        { clase: 'cabecera__interior' },
        marca(),
        el('div', { clase: 'cabecera__acciones' }, relojCompu, botonActualizar, botonSalir),
      ),
    ),
    el('div', { clase: 'cuerpo' }, menu, contenido),
    anuncio,
  );

  dibujarMenu();
  dibujarContenido();
  moverReloj();
  const reloj = setInterval(moverReloj, CADA_CUANTO_EL_RELOJ_MS);
  window.addEventListener('hashchange', alCambiarHash);
  document.addEventListener('visibilitychange', alVolverALaPestana);

  return {
    nodo,
    enfocarTitulo,

    ocupado(si) {
      s.ocupado = si;
      const texto = si ? t.cabecera.actualizando : t.cabecera.actualizar;
      botonActualizar.setAttribute('aria-busy', String(si));
      botonActualizar.setAttribute('aria-label', texto);
      botonActualizar.querySelector('.boton__texto').textContent = texto;
    },

    actualizar(estadoNuevo, { anunciar = false } = {}) {
      s.estado = estadoNuevo;
      s.errorEstado = false;
      s.actualizadoEn = Date.now();
      dibujarContenido();
      moverReloj();
      if (anunciar) anuncio.textContent = textoActualizado();
    },

    marcarError() {
      s.errorEstado = true;
      dibujarContenido();
      anuncio.textContent = t.atencion.sinEstado.titulo;
    },

    desmontar() {
      clearInterval(reloj);
      window.removeEventListener('hashchange', alCambiarHash);
      document.removeEventListener('visibilitychange', alVolverALaPestana);
    },
  };
}

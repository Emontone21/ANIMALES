/** Pantallas centradas: cargando, ingreso, acceso denegado y error. */

import { t } from '../i18n/es-UY.js';
import { boton, el, icono, marca, variables } from './componentes.js';

function centrada(...hijos) {
  return el('main', { clase: 'centrada' }, el('div', { clase: 'centrada__columna' }, ...hijos));
}

function titulos(titulo, bajada) {
  return el(
    'div',
    { clase: 'centrada__titulos' },
    marca({ grande: true }),
    el('h1', { tabindex: '-1', texto: titulo }),
    bajada ? el('p', { clase: 'secundario', texto: bajada }) : null,
  );
}

function mensaje(tipo, ...hijos) {
  const nombreIcono = tipo === 'info' ? 'pendiente' : tipo;
  return el(
    'div',
    { clase: `mensaje mensaje--${tipo}` },
    icono(nombreIcono),
    el('div', { clase: 'mensaje__cuerpo' }, ...hijos),
  );
}

export function pantallaCargando() {
  return centrada(
    el(
      'div',
      { clase: 'centrada__titulos' },
      marca({ grande: true }),
      el('p', { clase: 'secundario', role: 'status', texto: t.general.cargando }),
    ),
  );
}

/** Lo que falta en Vercel para poder entrar (sin Supabase o sin ADMIN_USER_IDS). */
function avisoDeConfiguracion({ faltan, invalidas }) {
  const s = t.ingreso.sinConfigurar;
  return mensaje(
    'atencion',
    el('strong', { texto: s.titulo }),
    faltan.length > 0 ? el('p', {}, `${s.faltan(faltan.length)} `, variables(faltan)) : null,
    invalidas.length > 0
      ? el('p', {}, `${s.invalidas(invalidas.length)} `, variables(invalidas))
      : null,
    el('p', { texto: s.ayuda }),
  );
}

/**
 * Ingreso con email y contraseña. `alEntrar(email, contrasena)` devuelve un
 * código de `t.ingreso.errores` si no pudo entrar; si entra, la app cambia de
 * pantalla. Con `configuracion` (falta configurar) o `bloqueada` (no cargó
 * supabase-js), el formulario queda deshabilitado.
 */
export function pantallaIngreso({
  alEntrar,
  configuracion = null,
  aviso = null,
  bloqueada = false,
}) {
  const deshabilitada = bloqueada || configuracion !== null;
  const zonaError = el('div', { role: 'alert' });

  const email = el('input', {
    id: 'ingreso-email',
    type: 'email',
    name: 'email',
    autocomplete: 'username',
    inputmode: 'email',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: true,
    disabled: deshabilitada,
  });
  const contrasena = el('input', {
    id: 'ingreso-contrasena',
    type: 'password',
    name: 'contrasena',
    autocomplete: 'current-password',
    required: true,
    disabled: deshabilitada,
  });
  const entrar = boton({
    texto: t.ingreso.entrar,
    variante: 'primario',
    tipo: 'submit',
    clases: 'boton--ancho',
  });
  entrar.disabled = deshabilitada;

  const mostrarError = (codigo) => {
    const texto = t.ingreso.errores[codigo] ?? t.ingreso.errores.otro;
    zonaError.replaceChildren(mensaje('falla', el('p', { texto })));
  };

  const formulario = el(
    'form',
    {
      clase: 'formulario',
      method: 'post',
      novalidate: true,
      onsubmit: async (evento) => {
        evento.preventDefault();
        if (entrar.getAttribute('aria-busy') === 'true' || deshabilitada) return;
        if (!email.value.trim() || !contrasena.value) {
          zonaError.replaceChildren(mensaje('falla', el('p', { texto: t.ingreso.faltanDatos })));
          (email.value.trim() ? contrasena : email).focus();
          return;
        }
        zonaError.replaceChildren();
        entrar.setAttribute('aria-busy', 'true');
        entrar.querySelector('.boton__texto').textContent = t.ingreso.entrando;
        const codigo = await alEntrar(email.value.trim(), contrasena.value);
        // Si entró, esta pantalla ya no está; si no, se muestra el error.
        if (codigo) {
          entrar.removeAttribute('aria-busy');
          entrar.querySelector('.boton__texto').textContent = t.ingreso.entrar;
          contrasena.value = '';
          mostrarError(codigo);
          contrasena.focus();
        }
      },
    },
    el(
      'div',
      { clase: 'campo' },
      el('label', { for: 'ingreso-email', texto: t.ingreso.email }),
      email,
    ),
    el(
      'div',
      { clase: 'campo' },
      el('label', { for: 'ingreso-contrasena', texto: t.ingreso.contrasena }),
      contrasena,
    ),
    zonaError,
    entrar,
  );

  if (bloqueada) mostrarError('biblioteca');

  return centrada(
    titulos(t.ingreso.titulo, t.ingreso.bajada),
    configuracion ? avisoDeConfiguracion(configuracion) : null,
    aviso ? mensaje('info', el('p', { texto: aviso })) : null,
    el('div', { clase: 'tarjeta' }, formulario),
    el('p', { clase: 'nota', texto: t.ingreso.nota }),
  );
}

export function pantallaDenegado({ alVolver }) {
  return centrada(
    titulos(t.denegado.titulo),
    mensaje('falla', el('p', { texto: t.denegado.detalle })),
    boton({
      texto: t.denegado.volver,
      variante: 'primario',
      clases: 'boton--ancho',
      alTocar: alVolver,
    }),
  );
}

export function pantallaError({ alReintentar }) {
  return centrada(
    titulos(t.error.titulo),
    mensaje('falla', el('p', { texto: t.error.detalle })),
    boton({
      texto: t.general.reintentar,
      nombreIcono: 'actualizar',
      variante: 'primario',
      clases: 'boton--ancho',
      alTocar: alReintentar,
    }),
  );
}

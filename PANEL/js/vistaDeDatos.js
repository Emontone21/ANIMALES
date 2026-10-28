/**
 * Lo que muestra una tarjeta con datos: el número grande, las líneas de
 * detalle, la gráfica de 7 días y las barras de uso. Todo con textContent; las
 * alturas y anchos, con `style` desde JavaScript (la CSP no lo bloquea).
 * Solo se llama con datos ya revisados por js/datos.js.
 */

import { t } from '../i18n/es-UY.js';
import { el } from './componentes.js';
import { bytes, diaDeSemana, fecha, fechaYHora, numero, porcentaje } from './formato.js';
import { diasHasta, haceCuanto } from './tiempo.js';

const D = t.datos;

function grande(valor, etiqueta) {
  return el(
    'p',
    { clase: 'dato' },
    el('span', { clase: 'numero', texto: numero(valor) }),
    el('span', { clase: 'dato__etiqueta', texto: etiqueta }),
  );
}

const linea = (texto) => el('p', { clase: 'dato__linea', texto });

/** Hoy en acento y los 6 días anteriores en barra suave. */
function barras(porDia) {
  const maximo = Math.max(1, ...porDia.map((d) => d.casos));
  const descripcion = D.casosPorDia(
    porDia.map((d) => `${diaDeSemana(d.dia)} ${numero(d.casos)}`).join(', '),
  );
  return el(
    'div',
    { clase: 'barras', role: 'img', 'aria-label': descripcion },
    porDia.map((d, i) => {
      const hoy = i === porDia.length - 1;
      const barra = el('span', {
        clase: hoy ? 'barras__barra barras__barra--hoy' : 'barras__barra',
      });
      barra.style.height = `${Math.round((d.casos / maximo) * 100)}%`;
      return barra;
    }),
  );
}

/** Una barra de uso contra el límite del plan. El texto ya dice lo mismo. */
function uso(etiqueta, usado, limite) {
  const relleno = el('div', { clase: 'uso__relleno' });
  relleno.style.width = `${Math.min(100, (usado / limite) * 100)}%`;
  return el(
    'div',
    { clase: 'uso__bloque' },
    el(
      'p',
      { clase: 'uso__texto' },
      el('span', { clase: 'uso__etiqueta', texto: etiqueta }),
      el('span', { texto: D.deLimite(bytes(usado), bytes(limite), porcentaje(usado, limite)) }),
    ),
    el('div', { clase: 'uso', 'aria-hidden': 'true' }, relleno),
  );
}

const CUERPOS = {
  'app.casosNuevos': (d) => [
    grande(d.nuevos24h, D.en24h),
    linea(D.en7d(numero(d.nuevos7d))),
    barras(d.porDia),
  ],
  'app.reunidos': (d) => [grande(d.reunidos, D.enTotal), linea(D.en30d(numero(d.reunidos30d)))],
  'app.coincidencias': (d) => [
    grande(d.pendientes, D.sinRevisar),
    d.pendientes > 0 && d.pendienteDesde ? linea(D.laMasVieja(haceCuanto(d.pendienteDesde))) : null,
  ],
  'app.moderacion': (d) => [
    grande(d.denuncias, D.denunciasSinRevisar(d.denuncias)),
    linea(D.ocultos(d.casosOcultos, d.historiasOcultas)),
    linea(D.erroresSinResolver(d.errores)),
  ],
  'app.usuarios': (d) => [
    grande(d.nuevos24h, D.en24h),
    linea(D.en7dYTotal(numero(d.nuevos7d), numero(d.total))),
  ],
  'app.fotosTrabadas': (d) => [
    grande(d.trabadas, D.esperanMasDe30(d.trabadas)),
    d.sinReintentos > 0 ? linea(D.sinReintentos(numero(d.sinReintentos))) : null,
    d.esperandoDesde ? linea(D.laMasViejaEspera(haceCuanto(d.esperandoDesde))) : null,
  ],
  'infra.vercel': (d) => [
    el('p', { clase: 'dato__estado', texto: D.deploy[d.estado] }),
    d.commit
      ? el('p', { clase: 'dato__linea' }, `${D.commit} `, el('code', { texto: d.commit }))
      : null,
    d.creado ? linea(D.creado(fechaYHora(d.creado), haceCuanto(d.creado))) : null,
  ],
  'infra.supabase': (d) => [
    uso(D.base, d.baseBytes, d.baseLimite),
    uso(D.storage, d.storageBytes, d.storageLimite),
  ],
  'infra.vision': (d) => [
    grande(d.esperando, D.fotosEnEspera(d.esperando)),
    linea(D.llamadas(d.llamadas24h, d.errores24h)),
    d.ultimaProcesada ? linea(D.ultimaProcesada(haceCuanto(d.ultimaProcesada))) : null,
    d.iaActiva ? null : linea(D.iaApagada),
  ],
};

/** El contenido de una tarjeta con datos, o null si no tiene. */
export function cuerpoDeDatos(id, item) {
  const armar = CUERPOS[id];
  if (!item.datos || !armar) return null;
  return el('div', { clase: 'datos' }, armar(item.datos));
}

/** El detalle corto de las filas del celular (Infraestructura), con datos. */
export function resumenCorto(id, item) {
  const d = item.datos;
  if (!d) return null;
  if (id === 'infra.vercel' && d.estado) {
    return d.commit ? `${D.deploy[d.estado]} · ${d.commit}` : D.deploy[d.estado];
  }
  if (id === 'infra.supabase') {
    return D.usoCorto(
      porcentaje(d.baseBytes, d.baseLimite),
      porcentaje(d.storageBytes, d.storageLimite),
    );
  }
  if (id === 'infra.vision') return `${numero(d.esperando)} ${D.fotosEnEspera(d.esperando)}`;
  return null;
}

/** El vencimiento de un token, para la lista de Tokens. */
export function lineaDeVencimiento(item, clase) {
  const d = item.datos;
  if (!d || !Object.hasOwn(d, 'vence')) return null;
  const texto = d.vence ? D.vence(fecha(d.vence), diasHasta(d.vence)) : D.noVence;
  return el('p', { clase, texto });
}

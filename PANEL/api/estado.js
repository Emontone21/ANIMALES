/**
 * GET /api/estado: el estado de cada parte del panel y de cada tarjeta, con
 * sus datos. Solo con una sesión de administración (ver _comun.js).
 *
 * Las variables dicen qué se puede consultar (_catalogo.js); las fuentes
 * traen los datos (_fuentes.js: admin_resumen() con el token de la sesión y
 * la API de Vercel) y _tarjetas.js decide el estado final con los umbrales.
 */

import { estadoDeVariable, json, tokenDe, validarSesion } from './_comun.js';
import { estadoDe, PARTES, TARJETAS } from './_catalogo.js';
import { leerResumen, leerVercel } from './_fuentes.js';
import { conDatos } from './_tarjetas.js';

const sirve = (env, nombres) => nombres.every((n) => estadoDeVariable(env, n) === 'ok');

export async function responderEstado(request, env, pedir = fetch) {
  const sesion = await validarSesion(request, env, pedir);
  if (!sesion.ok) return json({ error: sesion.error }, sesion.estado);

  const conToken = sirve(env, ['VERCEL_API_TOKEN']);
  const conProyecto = sirve(env, ['LINK_VERCEL_TEAM', 'LINK_VERCEL_PROJECT']);
  const [resumen, vercel] = await Promise.all([
    leerResumen(sesion.base, tokenDe(request), pedir),
    conToken ? leerVercel(env, { conProyecto }, pedir) : null,
  ]);
  const fuentes = { resumen, vercel, ahora: Date.now() };

  const partes = PARTES.map((parte) => {
    const estado = conDatos(parte, estadoDe(parte, env), fuentes);
    if (parte.id === 'ingreso' && estado.estado === 'ok' && sesion.base.adminsInvalidos > 0) {
      return { ...estado, estado: 'atencion', motivo: 'adminInvalidos' };
    }
    return estado;
  });
  const tarjetas = TARJETAS.map((tarjeta) => conDatos(tarjeta, estadoDe(tarjeta, env), fuentes));

  return json({ generadoEn: new Date(fuentes.ahora).toISOString(), partes, tarjetas });
}

export function GET(request) {
  return responderEstado(request, process.env);
}

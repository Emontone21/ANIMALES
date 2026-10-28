/**
 * GET /api/estado: valida la sesión y el permiso de administración y devuelve
 * el estado de cada parte del panel y de cada tarjeta.
 *
 * Por ahora solo mira las variables (por nombre, nunca su valor): ninguna
 * tarjeta tiene datos todavía. Los prompts siguientes suman los datos de cada
 * servicio acá, después de validar la sesión.
 */

import { json, validarSesion } from './_comun.js';
import { estadoDe, PARTES, TARJETAS } from './_catalogo.js';

export async function responderEstado(request, env, pedir = fetch) {
  const sesion = await validarSesion(request, env, pedir);
  if (!sesion.ok) return json({ error: sesion.error }, sesion.estado);

  const partes = PARTES.map((parte) => {
    const estado = estadoDe(parte, env);
    if (parte.id === 'ingreso' && estado.estado === 'ok' && sesion.base.adminsInvalidos > 0) {
      return { ...estado, estado: 'atencion', motivo: 'adminInvalidos' };
    }
    return estado;
  });

  return json({
    generadoEn: new Date().toISOString(),
    partes,
    tarjetas: TARJETAS.map((tarjeta) => estadoDe(tarjeta, env)),
  });
}

export function GET(request) {
  return responderEstado(request, process.env);
}

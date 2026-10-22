import { empezarRecuperacionConLink } from '@/features/auth/recuperacion';
import { ErrorAuth } from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';
import { esErrorDeRed } from '@/lib/errores';
import { crearClienteDeUnUso } from '@/lib/supabase';
import type { LinkDeMail, TipoLinkDeMail } from '@/lib/urlAuth';

/**
 * Lo que pasó al abrir el link de un mail en /auth/confirmar.
 * - cuentaConfirmada, emailCambiado: listo; la persona ingresa con su contraseña.
 * - faltaElOtroEmail: el cambio de email pide confirmar desde las dos direcciones.
 * - recuperacion: falta elegir la contraseña nueva (useRecuperacion).
 * - vencido: el link venció o ya se usó.
 */
export type ResultadoLinkDeMail =
  | { tipo: 'cuentaConfirmada' }
  | { tipo: 'emailCambiado' }
  | { tipo: 'faltaElOtroEmail' }
  | { tipo: 'recuperacion' }
  | { tipo: 'vencido'; link: TipoLinkDeMail };

/** Un link se canjea una sola vez, aunque la pantalla se monte dos veces. */
const canjes = new Map<string, Promise<ResultadoLinkDeMail>>();

/**
 * Canjea el link con verifyOtp, en un cliente de un uso (crearClienteDeUnUso):
 * sirve en cualquier navegador y no toca la sesión de la app.
 * - Confirmar la cuenta y cambiar el email no dejan ninguna sesión abierta: la
 *   que abre Supabase al verificar se cierra enseguida.
 * - Recuperar la contraseña la guarda en memoria hasta que la persona ve de qué
 *   cuenta es y elige la contraseña nueva (recuperacion.ts).
 * Un error de red no gasta el link: se puede probar de nuevo.
 */
export function abrirLinkDeMail(link: LinkDeMail): Promise<ResultadoLinkDeMail> {
  const clave = `${link.tipo}:${link.tokenHash}`;
  const enCurso = canjes.get(clave);
  if (enCurso) return enCurso;
  const canje = canjear(link);
  canjes.set(clave, canje);
  canje.catch(() => canjes.delete(clave));
  return canje;
}

async function canjear({ tokenHash, tipo }: LinkDeMail): Promise<ResultadoLinkDeMail> {
  const cliente = crearClienteDeUnUso();
  const { data, error } = await cliente.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  if (error) {
    // 4xx: venció, ya se usó o no existe (otp_expired). Lo demás (la red, el
    // servidor, muchos pedidos seguidos) se puede volver a probar.
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      return { tipo: 'vencido', link: tipo };
    }
    if (esErrorDeRed(error)) throw new ErrorAuth(t.comunes.sinConexion);
    if (error.status === 429) throw new ErrorAuth(t.auth.errores.muchosIntentos);
    throw new ErrorAuth(t.auth.confirmar.errorServidor);
  }

  if (tipo === 'recovery') {
    if (!data.session) return { tipo: 'vencido', link: tipo };
    empezarRecuperacionConLink(cliente, data.session.user.email);
    return { tipo: 'recuperacion' };
  }

  // Confirmado: la sesión que abrió el link se cierra en Supabase (solo esa).
  if (data.session) await cliente.auth.signOut({ scope: 'local' });
  if (tipo === 'signup') return { tipo: 'cuentaConfirmada' };
  // Con dos confirmaciones (Secure email change), la primera no abre sesión.
  return data.session ? { tipo: 'emailCambiado' } : { tipo: 'faltaElOtroEmail' };
}

/** Qué se muestra después de abrir el link, y adónde lleva el botón. */
export type PantallaDelLink = {
  mensaje: string;
  tipo: 'exito' | 'error' | 'info';
  boton: 'ingresar' | 'mapa' | 'recuperar';
};

/**
 * `conSesion`: ya hay una sesión abierta en la app (por ejemplo, de otra
 * cuenta). Ingresar no se ofrece: primero habría que cerrarla.
 */
export function pantallaDelLink(
  resultado: Exclude<ResultadoLinkDeMail, { tipo: 'recuperacion' }>,
  conSesion: boolean,
): PantallaDelLink {
  const ingresar = conSesion ? 'mapa' : 'ingresar';
  switch (resultado.tipo) {
    case 'cuentaConfirmada':
      return { mensaje: t.auth.confirmar.cuentaConfirmada, tipo: 'exito', boton: ingresar };
    case 'emailCambiado':
      return { mensaje: t.auth.confirmar.emailCambiado, tipo: 'exito', boton: ingresar };
    case 'faltaElOtroEmail':
      return { mensaje: t.auth.confirmar.faltaElOtroEmail, tipo: 'info', boton: 'mapa' };
    case 'vencido':
      if (resultado.link === 'recovery') {
        return { mensaje: t.auth.nuevaContrasena.linkVencido, tipo: 'error', boton: 'recuperar' };
      }
      if (resultado.link === 'signup') {
        return { mensaje: t.auth.confirmar.vencidoCuenta, tipo: 'error', boton: ingresar };
      }
      return { mensaje: t.auth.confirmar.vencidoEmail, tipo: 'error', boton: 'mapa' };
  }
}

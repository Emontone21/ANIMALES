import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { CLAVE_CAPTCHA, opcionesCaptcha } from '@/features/auth/captcha';
import { clienteDeRecuperacion, terminarRecuperacion } from '@/features/auth/recuperacion';
import { VERSION_TERMINOS } from '@/features/legal/terminos';
import {
  ErrorAuth,
  traducirError,
  validarContrasenaNueva,
  validarEmail,
  validarEmailYContrasena,
  validarRegistro,
} from '@/features/auth/validaciones';
import { t } from '@/i18n/es-UY';
import { supabase } from '@/lib/supabase';
import { codigoDeAuth, leerParametros, tieneErrorAuth } from '@/lib/urlAuth';

WebBrowser.maybeCompleteAuthSession();

const esWeb = Platform.OS === 'web';

/**
 * Adónde vuelve Supabase después de Google, con un ?code= (flujo PKCE, ver
 * src/lib/supabase.ts). Los mails nuevos no lo usan: su link va a
 * /auth/confirmar en el sitio (supabase/templates/); el que se manda todavía
 * sirve para los mails viejos, con ConfirmationURL.
 * Web: la raíz del sitio (Supabase canjea el código solo).
 * Nativo: spotmvd://auth/callback (exp://… en Expo Go).
 */
const redirectTo = esWeb ? Linking.createURL('/') : Linking.createURL('auth/callback');

/**
 * Adónde volvía el link para elegir una contraseña nueva con la plantilla
 * vieja (ConfirmationURL). La nueva va a /auth/confirmar. Tiene que estar en
 * las Redirect URLs de Supabase (ver docs/reportes/2026-10-19-cuenta.md).
 */
const redirectRecuperacion = esWeb
  ? Linking.createURL('/auth/nueva-contrasena')
  : Linking.createURL('auth/nueva-contrasena');

/** `captcha`: el token de Turnstile, si hay captcha (ver captcha.ts). */
export async function ingresarConEmail(
  email: string,
  contrasena: string,
  captcha?: string | null,
): Promise<void> {
  validarEmailYContrasena(email, contrasena);
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: contrasena,
    options: opcionesCaptcha(CLAVE_CAPTCHA, captcha),
  });
  if (error) throw traducirError(error);
}

export async function registrarse(
  nombrePublico: string,
  email: string,
  contrasena: string,
  aceptoTerminos: boolean,
  captcha?: string | null,
): Promise<{ requiereConfirmacion: boolean }> {
  const nombre = validarRegistro(nombrePublico, email, contrasena, aceptoTerminos);
  const conCaptcha = opcionesCaptcha(CLAVE_CAPTCHA, captcha);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: contrasena,
    options: {
      ...conCaptcha,
      emailRedirectTo: redirectTo,
      // El trigger handle_new_user los copia a perfiles: el nombre público y la
      // versión de los términos que aceptó con la casilla, con la fecha.
      data: { nombre_publico: nombre, terminos_version: VERSION_TERMINOS },
    },
  });
  if (error) throw traducirError(error);
  return { requiereConfirmacion: !data.session };
}

/**
 * OAuth con Google vía el navegador del sistema. Supabase redirige a
 * spotmvd://auth/callback con un código que se canjea acá.
 */
export async function ingresarConGoogle(): Promise<void> {
  if (esWeb) {
    // El navegador va a Google y vuelve a la raíz con el código en la URL.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw traducirError(error);
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw traducirError(error ?? { message: 'sin url' });

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultado.type !== 'success') throw new ErrorAuth(t.auth.errores.googleCancelado);

  await crearSesionDesdeUrl(resultado.url);
}

/**
 * Manda el link para elegir una contraseña nueva. Supabase responde igual
 * exista o no la cuenta, y la app muestra siempre el mismo mensaje.
 */
export async function pedirRecuperacion(email: string, captcha?: string | null): Promise<void> {
  validarEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    ...opcionesCaptcha(CLAVE_CAPTCHA, captcha),
    redirectTo: redirectRecuperacion,
  });
  if (!error) return;
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    throw new ErrorAuth(t.auth.recuperar.muchosPedidos);
  }
  if (error.code === 'captcha_failed') throw new ErrorAuth(t.auth.errores.captcha);
  throw new ErrorAuth(t.auth.recuperar.error);
}

/**
 * Guarda la contraseña nueva con la sesión que abrió el link de recuperación.
 * Si vino del link del mail (/auth/confirmar), esa sesión estaba solo en
 * memoria: la persona ya vio de qué cuenta es y eligió la contraseña, así que
 * recién ahora pasa a la app. `conSesion` es false si no se pudo pasar: la
 * contraseña cambió igual y la persona ingresa con la nueva.
 */
export async function cambiarContrasena(
  nueva: string,
  repetida: string,
): Promise<{ conSesion: boolean }> {
  validarContrasenaNueva(nueva, repetida);

  const delLink = clienteDeRecuperacion();
  if (delLink) {
    const { data, error } = await delLink.auth.updateUser({ password: nueva });
    if (error) throw traducirError(error);
    const { data: guardada } = await delLink.auth.getSession();
    terminarRecuperacion();
    const sesion = guardada.session;
    if (!sesion || !data.user) return { conSesion: false };
    const { error: alPasar } = await supabase.auth.setSession({
      access_token: sesion.access_token,
      refresh_token: sesion.refresh_token,
    });
    return { conSesion: !alPasar };
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ErrorAuth(t.auth.nuevaContrasena.linkVencido);
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw traducirError(error);
  terminarRecuperacion();
  return { conSesion: true };
}

/**
 * Canjea el código de una URL de redirección (nativo) y abre sesión. Solo sirve
 * con el verificador que guardó esta app al pedirlo: un link con tokens
 * ajenos (#access_token=…) no abre nada (auditoría 2, S-M1 y S-B5). Si el link
 * era de recuperación, Supabase avisa PASSWORD_RECOVERY (recuperacion.ts).
 */
export async function crearSesionDesdeUrl(url: string): Promise<void> {
  const params = leerParametros(url);
  if (tieneErrorAuth(params)) {
    throw new ErrorAuth(params['error_code'] ?? params['error_description'] ?? params['error']);
  }

  const codigo = codigoDeAuth(params);
  if (!codigo) return;

  const { error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (!error) return;
  // El mismo link puede llegar dos veces (al volver del navegador y como deep
  // link): si el primero ya abrió la sesión, el segundo no es un error.
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  throw traducirError(error);
}

export async function cerrarSesion(): Promise<void> {
  // Este navegador deja de recibir las notificaciones de la cuenta: con la
  // sesión todavía abierta, para poder borrar su suscripción.
  if (Platform.OS === 'web') {
    try {
      const { olvidarEsteCelular } = await import('@/features/notificaciones/celular');
      await olvidarEsteCelular();
    } catch {
      // Sin red: la suscripción se borra cuando el servicio de push la dé por vencida.
    }
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw traducirError(error);
}

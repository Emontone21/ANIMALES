import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { marcarRecuperacion } from '@/features/auth/recuperacion';
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
import { leerParametros, tieneErrorAuth } from '@/lib/urlAuth';

WebBrowser.maybeCompleteAuthSession();

const esWeb = Platform.OS === 'web';

/**
 * Adónde vuelve Supabase después de confirmar email u OAuth.
 * Web: la raíz del sitio (Supabase lee los tokens de la URL solo).
 * Nativo: encontrados://auth/callback (exp://… en Expo Go).
 */
const redirectTo = esWeb ? Linking.createURL('/') : Linking.createURL('auth/callback');

/**
 * Adónde vuelve el link para elegir una contraseña nueva. Tiene que estar en
 * las Redirect URLs de Supabase (ver docs/reportes/2026-10-19-cuenta.md).
 */
const redirectRecuperacion = esWeb
  ? Linking.createURL('/auth/nueva-contrasena')
  : Linking.createURL('auth/nueva-contrasena');

export async function ingresarConEmail(email: string, contrasena: string): Promise<void> {
  validarEmailYContrasena(email, contrasena);
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: contrasena,
  });
  if (error) throw traducirError(error);
}

export async function registrarse(
  nombrePublico: string,
  email: string,
  contrasena: string,
  aceptoTerminos: boolean,
): Promise<{ requiereConfirmacion: boolean }> {
  const nombre = validarRegistro(nombrePublico, email, contrasena, aceptoTerminos);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: contrasena,
    options: {
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
 * encontrados://auth/callback con los tokens en el fragmento de la URL.
 */
export async function ingresarConGoogle(): Promise<void> {
  if (esWeb) {
    // El navegador va a Google y vuelve a la raíz con la sesión en la URL.
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
export async function pedirRecuperacion(email: string): Promise<void> {
  validarEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: redirectRecuperacion,
  });
  if (!error) return;
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    throw new ErrorAuth(t.auth.recuperar.muchosPedidos);
  }
  throw new ErrorAuth(t.auth.recuperar.error);
}

/** Guarda la contraseña nueva con la sesión que abrió el link de recuperación. */
export async function cambiarContrasena(nueva: string, repetida: string): Promise<void> {
  validarContrasenaNueva(nueva, repetida);
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ErrorAuth(t.auth.nuevaContrasena.linkVencido);
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw traducirError(error);
}

/** Lee access_token y refresh_token de una URL de redirección y abre sesión. */
export async function crearSesionDesdeUrl(url: string): Promise<void> {
  const params = leerParametros(url);
  if (tieneErrorAuth(params)) {
    throw new ErrorAuth(params['error_code'] ?? params['error_description'] ?? params['error']);
  }

  const accessToken = params['access_token'];
  const refreshToken = params['refresh_token'];
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw traducirError(error);
  // En nativo setSession avisa SIGNED_IN, no PASSWORD_RECOVERY.
  if (params['type'] === 'recovery') marcarRecuperacion();
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw traducirError(error);
}

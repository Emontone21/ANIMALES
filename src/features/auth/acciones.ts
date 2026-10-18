import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { t } from '@/i18n/es-UY';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const esWeb = Platform.OS === 'web';

/**
 * Adónde vuelve Supabase después de confirmar email u OAuth.
 * Web: la raíz del sitio (Supabase lee los tokens de la URL solo).
 * Nativo: encontrados://auth/callback (exp://… en Expo Go).
 */
const redirectTo = esWeb ? Linking.createURL('/') : Linking.createURL('auth/callback');

/**
 * Supabase devuelve los tokens en el fragmento (#access_token=…) o, si hubo
 * error, en la query (?error_code=…). Leemos los dos.
 */
function leerParametros(url: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  const [sinFragmento, fragmento] = url.split('#');
  const query = sinFragmento?.split('?')[1];
  for (const parte of [query, fragmento]) {
    if (!parte) continue;
    for (const [clave, valor] of new URLSearchParams(parte)) {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

export class ErrorAuth extends Error {}

const MIN_CONTRASENA = 8;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Traduce los errores más comunes de Supabase Auth a mensajes en español. */
function traducirError(error: { message: string; code?: string }): ErrorAuth {
  const codigo = error.code ?? '';
  const mensaje = error.message.toLowerCase();

  if (codigo === 'invalid_credentials' || mensaje.includes('invalid login credentials')) {
    return new ErrorAuth(t.auth.errores.credenciales);
  }
  if (codigo === 'email_not_confirmed' || mensaje.includes('email not confirmed')) {
    return new ErrorAuth(t.auth.errores.emailNoConfirmado);
  }
  if (codigo === 'user_already_exists' || mensaje.includes('already registered')) {
    return new ErrorAuth(t.auth.errores.yaRegistrado);
  }
  if (codigo === 'weak_password' || mensaje.includes('password')) {
    return new ErrorAuth(t.auth.errores.contrasenaCorta);
  }
  if (codigo === 'validation_failed' || mensaje.includes('email')) {
    return new ErrorAuth(t.auth.errores.emailInvalido);
  }
  return new ErrorAuth(t.auth.errores.desconocido);
}

function validarEmailYContrasena(email: string, contrasena: string): void {
  if (!EMAIL_VALIDO.test(email.trim())) throw new ErrorAuth(t.auth.errores.emailInvalido);
  if (contrasena.length < MIN_CONTRASENA) throw new ErrorAuth(t.auth.errores.contrasenaCorta);
}

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
): Promise<{ requiereConfirmacion: boolean }> {
  const nombre = nombrePublico.trim();
  if (nombre.length < 2) throw new ErrorAuth(t.auth.errores.nombreCorto);
  validarEmailYContrasena(email, contrasena);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: contrasena,
    options: {
      emailRedirectTo: redirectTo,
      // El trigger handle_new_user lo copia a perfiles.nombre_publico.
      data: { nombre_publico: nombre },
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

/** Lee access_token y refresh_token de una URL de redirección y abre sesión. */
export async function crearSesionDesdeUrl(url: string): Promise<void> {
  const params = leerParametros(url);
  const errorCode = params['error_code'] ?? params['error_description'] ?? params['error'];
  if (errorCode) throw new ErrorAuth(errorCode);

  const accessToken = params['access_token'];
  const refreshToken = params['refresh_token'];
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw traducirError(error);
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw traducirError(error);
}

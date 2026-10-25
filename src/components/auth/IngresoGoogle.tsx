import { BotonGoogleRespaldo } from '@/components/auth/BotonGoogleRespaldo';

/**
 * Ingresar con Google en Ingresar y Registrarse. En nativo, el botón de
 * siempre (signInWithOAuth); en web, el botón de Google Identity Services
 * (IngresoGoogle.web.tsx). Las pantallas lo cargan con lazy: en web, su
 * bloque se baja recién al abrirlas.
 */
export type PropsIngresoGoogle = {
  /** Mientras se ingresa con email. */
  deshabilitado?: boolean;
};

export default function IngresoGoogle({ deshabilitado }: PropsIngresoGoogle) {
  return <BotonGoogleRespaldo deshabilitado={deshabilitado} />;
}

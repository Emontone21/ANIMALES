/**
 * "Instalar la app" en Perfil: qué ofrecer según el navegador. Reglas puras,
 * sin React ni el navegador: las prueba __tests__/formaDeInstalar.test.ts.
 *
 * - `aviso`: Chrome o Edge (Android y computadora) ofrecieron instalarla
 *   (beforeinstallprompt); el botón abre su ventana.
 * - `pasosIos`: iPhone o iPad. No hay aviso: se agrega desde Compartir.
 * - `abrirEnNavegador`: el navegador de WhatsApp, Instagram o Facebook, que no
 *   instala: hay que abrir el link en Chrome o Safari.
 * - `ninguna`: ya está instalada, es la app nativa o el navegador no la ofrece.
 */
export type FormaDeInstalar = 'ninguna' | 'aviso' | 'pasosIos' | 'abrirEnNavegador';

export type AppConNavegador = 'WhatsApp' | 'Instagram' | 'Facebook';

export type DatosNavegador = {
  /** Platform.OS: en la app nativa no se ofrece. */
  plataforma: string;
  userAgent: string;
  /** navigator.maxTouchPoints: un iPad con iPadOS se presenta como una Mac. */
  puntosDeToque: number;
  /** Abierta como app: display-mode standalone o navigator.standalone (iPhone). */
  abiertaComoApp: boolean;
  /** Se instaló en esta visita (appinstalled o aceptó la ventana). */
  recienInstalada: boolean;
  /** Chrome o Edge mandaron beforeinstallprompt y todavía no se usó. */
  hayAviso: boolean;
};

/** El navegador propio de una app (WhatsApp, Instagram, Facebook o Messenger), o null. */
export function appConNavegador(userAgent: string): AppConNavegador | null {
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(userAgent)) return 'Facebook';
  if (/WhatsApp/i.test(userAgent)) return 'WhatsApp';
  return null;
}

/** iPhone, iPod o iPad (también el iPad que dice ser una Mac, porque tiene pantalla táctil). */
export function esIos(userAgent: string, puntosDeToque: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && puntosDeToque > 1);
}

export function formaDeInstalar(datos: DatosNavegador): FormaDeInstalar {
  if (datos.plataforma !== 'web' || datos.abiertaComoApp || datos.recienInstalada) return 'ninguna';
  if (appConNavegador(datos.userAgent)) return 'abrirEnNavegador';
  if (datos.hayAviso) return 'aviso';
  if (esIos(datos.userAgent, datos.puntosDeToque)) return 'pasosIos';
  return 'ninguna';
}

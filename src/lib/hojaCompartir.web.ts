import type { MensajeCompartir } from '@/lib/compartir';

/** Cómo terminó el intento de compartir. "sinHoja": hay que ofrecer WhatsApp y copiar. */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'sinHoja';

/** Texto y link juntos, para donde no hay un campo aparte para el link. */
export function mensajeCompleto({ texto, url }: MensajeCompartir): string {
  return `${texto} ${url}`;
}

/**
 * Web: navigator.share abre la hoja del sistema en el celular (y en algunas
 * computadoras). El link va aparte: la app que se elija lo pone después del texto.
 */
export async function abrirHojaCompartir(mensaje: MensajeCompartir): Promise<ResultadoCompartir> {
  const datos = { title: mensaje.titulo, text: mensaje.texto, url: mensaje.url };
  if (typeof navigator.share !== 'function' || navigator.canShare?.(datos) === false) {
    return 'sinHoja';
  }
  try {
    await navigator.share(datos);
    return 'compartido';
  } catch (error) {
    // Cerró la hoja sin elegir nada: no hace falta ofrecer otra cosa.
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado';
    return 'sinHoja';
  }
}

export function abrirWhatsApp(mensaje: MensajeCompartir): void {
  const url = `https://wa.me/?text=${encodeURIComponent(mensajeCompleto(mensaje))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Copia el link. Sin la API del portapapeles (sitio sin https), prueba a la antigua. */
export async function copiarLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const campo = document.createElement('textarea');
    campo.value = url;
    campo.setAttribute('readonly', '');
    Object.assign(campo.style, { position: 'fixed', top: '0', left: '0', opacity: '0' });
    document.body.appendChild(campo);
    campo.select();
    const copiado = document.execCommand('copy');
    campo.remove();
    return copiado;
  }
}

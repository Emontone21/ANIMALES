import { Linking, Share } from 'react-native';

import type { MensajeCompartir } from '@/lib/compartir';

/** Cómo terminó el intento de compartir. "sinHoja": hay que ofrecer WhatsApp y copiar. */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'sinHoja';

/** Texto y link juntos, para donde no hay un campo aparte para el link. */
export function mensajeCompleto({ texto, url }: MensajeCompartir): string {
  return `${texto} ${url}`;
}

/**
 * Android/iOS: la hoja de compartir del sistema. El link va dentro del mensaje:
 * Android ignora el campo url y en iOS, con los dos, el link sale repetido.
 */
export async function abrirHojaCompartir(mensaje: MensajeCompartir): Promise<ResultadoCompartir> {
  try {
    const resultado = await Share.share({
      title: mensaje.titulo,
      message: mensajeCompleto(mensaje),
    });
    return resultado.action === Share.dismissedAction ? 'cancelado' : 'compartido';
  } catch {
    return 'sinHoja';
  }
}

export function abrirWhatsApp(mensaje: MensajeCompartir): void {
  void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensajeCompleto(mensaje))}`);
}

/** En nativo siempre hay hoja de compartir; sin una librería de portapapeles no se copia. */
export async function copiarLink(_url: string): Promise<boolean> {
  return false;
}

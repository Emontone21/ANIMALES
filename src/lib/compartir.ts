// Rutas relativas a propósito: la función de la vista previa (api/) también
// importa este archivo, y ahí no existen los alias "@/".
import { t } from '../i18n/es-UY';
import type { DatosCompartir, EstadoAnimal, Especie, Tamanio, TipoReporte } from '../types/dominio';
import { ENV } from './env';

/** El link que se comparte: <sitio>/animal/<id> (EXPO_PUBLIC_SITE_URL). */
export function linkDelCaso(id: string): string {
  return `${ENV.siteUrl}/animal/${id}`;
}

/** El link de la historia de un reencuentro: <sitio>/reencuentros/<id del caso>. */
export function linkDeHistoria(id: string): string {
  return `${ENV.siteUrl}/reencuentros/${id}`;
}

/**
 * El color es texto libre: si trae números (podría ser un teléfono), no va en la
 * vista previa del link ni en el texto de compartir (B37).
 */
export function colorParaCompartir(color: string | null): string | null {
  const limpio = color?.trim() ?? '';
  return limpio && !/\d/.test(limpio) ? limpio : null;
}

/** Lo que se necesita de un caso, tal como viene de animales_detalle o animales_mapa. */
export function datosParaCompartir(caso: {
  tipo_reporte: TipoReporte;
  estado: EstadoAnimal;
  nombre: string | null;
  especie: Especie;
  color: string | null;
  tamanio: Tamanio | null;
  tiene_collar: boolean;
}): DatosCompartir {
  return {
    tipo: caso.tipo_reporte,
    estado: caso.estado,
    nombre: caso.nombre,
    especie: caso.especie,
    color: colorParaCompartir(caso.color),
    tamanio: caso.tamanio,
    tieneCollar: caso.tiene_collar,
  };
}

/** Texto, link y título para la hoja de compartir. */
export function mensajeParaCompartir(id: string, caso: DatosCompartir) {
  return {
    titulo: t.compartir.vistaPrevia.titulo(caso),
    texto: t.compartir.texto(caso),
    url: linkDelCaso(id),
  };
}

export type MensajeCompartir = ReturnType<typeof mensajeParaCompartir>;

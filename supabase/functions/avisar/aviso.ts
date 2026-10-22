/**
 * De un aviso de preparar_avisos_push al mensaje que recibe el service worker
 * (public/sw.js): título, cuerpo, a dónde lleva y su grupo. Reglas puras, sin
 * la red: las prueban pruebas/aviso_test.ts.
 */

import { type Especie, TEXTOS } from './textos.ts';

export type TipoAviso = 'coincidencia' | 'avistamiento' | 'estado' | 'mensaje' | 'error';

export type Suscripcion = { id: string; endpoint: string; p256dh: string; auth: string };

/** Lo que devuelve preparar_avisos_push por cada aviso. */
export type Aviso = {
  aviso_id: number;
  tipo: TipoAviso;
  evento: string | null;
  animal_id: string | null;
  conversacion_id: string | null;
  reporte_error_id: string | null;
  moderacion: boolean;
  nombre: string | null;
  especie: Especie | null;
  para_familia: boolean;
  suscripciones: Suscripcion[];
};

/** Lo que va cifrado al celular. sw.js lo valida igual. */
export type Mensaje = { titulo: string; cuerpo: string; url: string; tag: string };

/** Cómo lo trata el servicio de push. */
export type Opciones = { urgencia: 'normal' | 'high'; ttl: number; topic?: string };

/** Medio día: pasado eso, la novedad ya está en Actividad. */
export const TTL_SEGUNDOS = 12 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El nombre del animal, si se puede mostrar en la pantalla bloqueada: lo
 * escribe la familia, así que con números, una arroba o un link (podría ser
 * un teléfono o un contacto) se usa la especie. Hasta 30 caracteres.
 */
export function nombreSeguro(nombre: string | null): string | null {
  const limpio = nombre?.replace(/\s+/g, ' ').trim() ?? '';
  if (!limpio || limpio.length > 30) return null;
  if (/\d|@|https?:|www\.|\.com/i.test(limpio)) return null;
  return limpio;
}

function uuid(valor: string | null): string | null {
  return valor && UUID.test(valor) ? valor.toLowerCase() : null;
}

export function armarMensaje(aviso: Aviso): { mensaje: Mensaje; opciones: Opciones } {
  const animalId = uuid(aviso.animal_id);
  const conversacionId = uuid(aviso.conversacion_id);
  const reporteId = uuid(aviso.reporte_error_id);
  const nombre = nombreSeguro(aviso.nombre);
  const especie: Especie = aviso.especie ?? 'otro';
  const aAnimal = nombre ? `a ${nombre}` : TEXTOS.animalA[especie];
  const elAnimal = nombre ?? TEXTOS.animalEl[especie];

  const url = conversacionId
    ? `/conversacion/${conversacionId}`
    : animalId
    ? `/animal/${animalId}`
    : reporteId && aviso.moderacion
    ? '/moderacion?seccion=errores'
    : '/actividad';
  // Un aviso nuevo del mismo caso o conversación reemplaza al anterior en el
  // celular (tag) y en el servicio de push si todavía no se entregó (Topic:
  // hasta 32 caracteres, el uuid sin guiones).
  const grupo = conversacionId
    ? { tag: `conversacion-${conversacionId}`, topic: conversacionId.replaceAll('-', '') }
    : animalId
    ? { tag: `caso-${animalId}`, topic: animalId.replaceAll('-', '') }
    : reporteId
    ? { tag: aviso.moderacion ? 'moderacion' : `error-${reporteId}` }
    : { tag: 'spot' };

  let texto: { titulo: string; cuerpo: string };
  let urgente = false;
  switch (aviso.tipo) {
    case 'avistamiento':
      urgente = true;
      texto = aviso.evento === 'resguardado'
        ? { titulo: TEXTOS.resguardado.titulo(aAnimal), cuerpo: TEXTOS.resguardado.cuerpo }
        : { titulo: TEXTOS.visto.titulo(aAnimal), cuerpo: TEXTOS.visto.cuerpo };
      break;
    case 'estado':
      texto = aviso.evento === 'reunido'
        ? { titulo: TEXTOS.reunido.titulo(elAnimal), cuerpo: TEXTOS.reunido.cuerpo }
        : aviso.evento === 'reabierto'
        ? { titulo: TEXTOS.reabierto.titulo(elAnimal), cuerpo: TEXTOS.reabierto.cuerpo }
        : TEXTOS.otro;
      break;
    case 'coincidencia':
      urgente = aviso.para_familia;
      texto = aviso.para_familia
        ? { titulo: TEXTOS.coincidenciaFamilia.titulo(nombre), cuerpo: TEXTOS.coincidenciaFamilia.cuerpo }
        : { titulo: TEXTOS.coincidencia.titulo(elAnimal), cuerpo: TEXTOS.coincidencia.cuerpo };
      break;
    case 'mensaje':
      urgente = true;
      texto = {
        titulo: TEXTOS.mensaje.titulo(animalId ? elAnimal : null),
        cuerpo: TEXTOS.mensaje.cuerpo,
      };
      break;
    case 'error':
      texto = aviso.moderacion ? TEXTOS.errorNuevo : TEXTOS.errorResuelto;
      break;
    default:
      texto = TEXTOS.otro;
  }

  return {
    mensaje: { ...texto, url, tag: grupo.tag },
    opciones: { urgencia: urgente ? 'high' : 'normal', ttl: TTL_SEGUNDOS, topic: grupo.topic },
  };
}

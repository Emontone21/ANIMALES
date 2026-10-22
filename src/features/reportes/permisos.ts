import { t } from '@/i18n/es-UY';
import type { AnimalDetalle, AvistamientoDetalle } from '@/types/dominio';

/**
 * Qué puede hacer cada persona con un caso, para mostrar u ocultar botones.
 * Son las mismas reglas que la base (cambiar_estado_animal, reporte_propio,
 * abrir_conversacion), que las vuelve a validar. Sin React: las pruebas las
 * usan directo.
 */

type Caso = Pick<AnimalDetalle, 'estado' | 'tipo_reporte' | 'creado_por' | 'oculto'>;

/**
 * Un caso reunido, para quien no participó: solo lo básico (la foto, el nombre
 * si la familia lo mostró, la especie, "Volvió a casa" y el link a su
 * historia). Lo decide la base (animales_detalle.reservado, migración 0027),
 * que tampoco manda el resto.
 */
export function soloLoBasico(caso: Pick<AnimalDetalle, 'reservado'>): boolean {
  return caso.reservado;
}

/** El título de lo básico: el nombre o, si la familia no lo mostró, "Un perro". */
export function tituloBasico(caso: Pick<AnimalDetalle, 'nombre' | 'especie'>): string {
  return t.reencuentros.tituloHistoria(caso.nombre, caso.especie);
}

export type PermisosCaso = {
  abierto: boolean;
  esCreador: boolean;
  esPerdido: boolean;
  /** Quien lo tiene resguardado ahora (solo hay si el caso está resguardado). */
  esQuienResguarda: boolean;
  /** Editar y borrar: solo quien lo publicó, y no un reporte que ya se unió a otro caso. */
  puedeGestionar: boolean;
  puedeResguardar: boolean;
  puedeReunir: boolean;
  puedeReabrir: boolean;
  /** Un caso oculto por moderación no se difunde. */
  puedeCompartir: boolean;
};

/**
 * `usuarioId`: quien mira (null sin cuenta). `resguardanteId`: quien lo tiene
 * resguardado, si está resguardado. Un caso anónimo (creado_por null) no tiene
 * creador: nadie cumple esCreador.
 */
export function permisosDelCaso(
  caso: Caso,
  usuarioId: string | null | undefined,
  resguardanteId: string | null | undefined,
): PermisosCaso {
  const abierto = caso.estado === 'avistado' || caso.estado === 'resguardado';
  const esCreador = !!usuarioId && caso.creado_por === usuarioId;
  const esPerdido = caso.tipo_reporte === 'perdido';
  const esQuienResguarda = !!usuarioId && resguardanteId === usuarioId;
  return {
    abierto,
    esCreador,
    esPerdido,
    esQuienResguarda,
    puedeGestionar: esCreador && caso.estado !== 'vinculado',
    // La familia no se avisa a sí misma que lo tiene: lo marca como reunido.
    puedeResguardar: caso.estado === 'avistado' && !(esPerdido && esCreador),
    puedeReunir:
      abierto && (esCreador || (!esPerdido && caso.estado === 'resguardado' && esQuienResguarda)),
    puedeReabrir:
      (caso.estado === 'resguardado' && (esCreador || (!esPerdido && esQuienResguarda))) ||
      (caso.estado === 'reunido' && esCreador),
    puedeCompartir: !caso.oculto,
  };
}

export type CambioDisponible = 'resguardar' | 'reunido' | 'reabrir';

/** Los cambios de estado que se ofrecen, en el orden en que se muestran. */
export function cambiosDisponibles(caso: Caso, permisos: PermisosCaso): CambioDisponible[] {
  const cambios: CambioDisponible[] = [];
  if (permisos.puedeResguardar) cambios.push('resguardar');
  if (permisos.puedeReabrir && caso.estado === 'resguardado') cambios.push('reabrir');
  if (permisos.puedeReunir) cambios.push('reunido');
  if (permisos.puedeReabrir && caso.estado === 'reunido') cambios.push('reabrir');
  return cambios;
}

export type Destinatario = { usuarioId: string; titulo: string };

/**
 * A quién se le puede escribir desde el caso: quien lo publicó y, si es otra
 * persona, quien lo resguarda. Nunca uno mismo, ni alguien que borró su
 * cuenta (queda sin usuario).
 */
export function destinatariosDelCaso(
  caso: Pick<AnimalDetalle, 'tipo_reporte' | 'creado_por'>,
  resguardanteId: string | null | undefined,
  usuarioId: string | null | undefined,
): Destinatario[] {
  const candidatos: { usuarioId: string | null | undefined; titulo: string }[] = [
    {
      usuarioId: caso.creado_por,
      titulo:
        caso.tipo_reporte === 'perdido'
          ? t.mensajes.escribirAFamilia
          : t.mensajes.escribirAPublicador,
    },
    ...(resguardanteId && resguardanteId !== caso.creado_por
      ? [{ usuarioId: resguardanteId, titulo: t.mensajes.escribirAResguardo }]
      : []),
  ];
  return candidatos.filter((d): d is Destinatario => !!d.usuarioId && d.usuarioId !== usuarioId);
}

/** Los avisos de otras personas que se pierden al borrar el caso (incluye cuentas borradas). */
export function avisosDeOtros(
  avistamientos: Pick<AvistamientoDetalle, 'usuario_id'>[],
  creadoPor: string | null,
): number {
  return avistamientos.filter((av) => av.usuario_id !== creadoPor).length;
}

/**
 * A quién de los que avisaron que lo vieron le puede escribir quien mira, con
 * "Escribirle" en el historial (abrir_conversacion, migración 0014). Solo
 * quien publicó el caso o un reporte unido a él: al unirse, el primer
 * avistamiento de cada reporte ("perdido" o "encontrado") pasa al caso
 * principal, así que se reconoce por ahí. Nunca a uno mismo ni a una cuenta
 * borrada (sin usuario), y no en un caso oculto: no se abren conversaciones
 * nuevas.
 */
export function aQuienesLoVieron(
  caso: Pick<AnimalDetalle, 'creado_por' | 'oculto'>,
  avistamientos: Pick<AvistamientoDetalle, 'usuario_id' | 'tipo'>[],
  usuarioId: string | null | undefined,
): string[] {
  if (!usuarioId || caso.oculto) return [];
  const publico =
    caso.creado_por === usuarioId ||
    avistamientos.some(
      (av) => av.usuario_id === usuarioId && (av.tipo === 'perdido' || av.tipo === 'encontrado'),
    );
  if (!publico) return [];
  const destinatarios = new Set<string>();
  for (const av of avistamientos) {
    if (av.usuario_id && av.usuario_id !== usuarioId) destinatarios.add(av.usuario_id);
  }
  return [...destinatarios];
}

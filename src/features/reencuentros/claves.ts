/**
 * Las claves de TanStack Query del muro de reencuentros. Van solas en este
 * archivo (que comparten el mapa, el muro y contar cómo volvió) para que lo que
 * cada bloque pide quede en su bloque y no en __common.
 */
export const clavesReencuentros = {
  /** Todo lo de reencuentros: se invalida entero al contar, editar o borrar una historia. */
  todo: ['reencuentros'] as const,
  contador: ['reencuentros', 'contador'] as const,
  muro: ['reencuentros', 'muro'] as const,
  historia: (id: string) => ['reencuentros', 'historia', id] as const,
  mia: (id: string) => ['reencuentros', 'mia', id] as const,
  participantes: (id: string) => ['reencuentros', 'participantes', id] as const,
  ayude: (usuarioId: string) => ['reencuentros', 'ayude', usuarioId] as const,
  denuncia: (usuarioId: string, id: string) => ['reencuentros', 'denuncia', usuarioId, id] as const,
  acceso: (usuarioId: string, id: string) => ['reencuentros', 'acceso', usuarioId, id] as const,
};

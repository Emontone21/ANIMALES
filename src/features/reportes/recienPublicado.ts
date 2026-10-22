/**
 * El caso que se acaba de publicar, para que su detalle pregunte una vez por
 * las notificaciones del celular. En memoria y no en la URL: al recargar o al
 * abrir el link otra vez, no pregunta.
 */
let recien: string | null = null;

export function marcarRecienPublicado(id: string): void {
  recien = id;
}

export function esRecienPublicado(id: string | undefined): boolean {
  return !!id && recien === id;
}

/** Se pregunta una sola vez: la próxima visita al caso ya no. */
export function olvidarRecienPublicado(id: string | undefined): void {
  if (id && recien === id) recien = null;
}

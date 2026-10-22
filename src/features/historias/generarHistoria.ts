import type { Esquema } from '@/constants/tema';
import type { DatosHistoria, DisenioHistoria } from '@/features/historias/disenio';

/**
 * En la app nativa no hay historia: el botón aparece solo en web, donde la
 * dibuja un canvas (generarHistoria.web.ts).
 */
export type Historia = { archivo: Blob; disenio: DisenioHistoria };

export async function generarHistoria(
  _datos: DatosHistoria,
  _urlDeLaFoto: string | null,
  _esquema: Esquema,
): Promise<Historia> {
  throw new Error('Solo en web');
}

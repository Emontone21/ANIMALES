import { t } from '@/i18n/es-UY';

/**
 * Reglas de "Contá cómo volvió", sin React ni Supabase: las prueba
 * __tests__/reencuentros.test.ts. La base las vuelve a validar
 * (guardar_historia_reencuentro, agradecer). Solo las usa esa pantalla: el
 * número del contador está en contador.ts.
 */

/** El tope de la frase y del mensaje de agradecimiento, como en la base. */
export const LARGO_MAXIMO = 280;

/** Como char_length de Postgres: un emoji cuenta uno. */
export function largo(texto: string): number {
  return [...texto].length;
}

export type Participacion = { lo_vio: boolean; lo_resguardo: boolean; le_escribio: boolean };

/** Cómo participó alguien: "Avisó que lo vio · Te escribió". */
export function comoParticipo(p: Participacion): string {
  const como = t.reencuentros.contar.comoAyudo;
  const partes: (string | null)[] = [
    p.lo_vio ? como.vio : null,
    p.lo_resguardo ? como.resguardo : null,
    p.le_escribio ? como.escribio : null,
  ];
  return partes.filter((x): x is string => !!x).join(' · ');
}

export type FormularioReencuentro = {
  frase: string;
  mensaje: string;
  /** Si ya había una historia (se está editando). */
  hayHistoria: boolean;
  /** A cuántos nuevos se marcó para agradecer. */
  marcados: number;
};

export type AccionReencuentro = 'publicar' | 'guardar' | 'agradecer';

/**
 * Qué hace el botón del formulario: con frase, publicar (o guardar los
 * cambios de) la historia, y agradecer a los marcados; sin frase, solo
 * agradecer. Null si no hay nada que hacer.
 */
export function accionDelFormulario(f: FormularioReencuentro): AccionReencuentro | null {
  if (f.frase.trim()) return f.hayHistoria ? 'guardar' : 'publicar';
  if (f.hayHistoria) return null;
  return f.marcados > 0 ? 'agradecer' : null;
}

/** Por qué no se puede guardar, o null si se puede. */
export function errorDelFormulario(f: FormularioReencuentro): string | null {
  const textos = t.reencuentros.contar;
  if (largo(f.frase.trim()) > LARGO_MAXIMO) return textos.fraseLarga;
  if (largo(f.mensaje.trim()) > LARGO_MAXIMO) return textos.mensajeLargo;
  if (f.hayHistoria && !f.frase.trim()) return textos.fraseVacia;
  if (!accionDelFormulario(f)) return textos.nadaQueGuardar;
  return null;
}

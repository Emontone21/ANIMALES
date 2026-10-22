/**
 * Los textos de las notificaciones del celular: una copia de t.avisosPush de
 * src/i18n/es-UY.ts (Supabase despliega solo supabase/functions, así que acá
 * no se puede importar de src/). __tests__/avisosPush.test.ts comprueba que
 * digan lo mismo.
 *
 * Se ven en la pantalla bloqueada: nunca nombres de personas, el texto de un
 * mensaje, contactos ni lugares. Del caso, solo su nombre o la especie.
 */

export type Especie = 'perro' | 'gato' | 'otro';

export const TEXTOS = {
  /** Sin nombre: la especie, para "al perro" y "el perro". */
  animalA: { perro: 'al perro', gato: 'al gato', otro: 'al animal' },
  animalEl: { perro: 'el perro', gato: 'el gato', otro: 'el animal' },
  /** Para "La familia del perro te agradeció". */
  animalDe: { perro: 'del perro', gato: 'del gato', otro: 'del animal' },
  /** "Alguien vio a Toby" / "Alguien vio al perro". */
  visto: {
    titulo: (aAnimal: string) => `Alguien vio ${aAnimal}`,
    cuerpo: 'Tocá para ver dónde lo vieron.',
  },
  resguardado: {
    titulo: (aAnimal: string) => `Alguien tiene ${aAnimal} a salvo`,
    cuerpo: 'Tocá para ver el caso.',
  },
  reunido: {
    titulo: (animal: string) => `¡${mayuscula(animal)} volvió con su familia!`,
    cuerpo: 'Un caso que seguías se cerró con final feliz.',
  },
  reabierto: {
    titulo: (animal: string) => `${mayuscula(animal)} se volvió a escapar`,
    cuerpo: 'Atento al mapa: tocá para ver el caso.',
  },
  /** A la familia de un perdido: solo ella confirma si es el mismo. */
  coincidenciaFamilia: {
    titulo: (nombre: string | null) =>
      nombre ? `Encontraron un animal parecido a ${nombre}` : 'Encontraron un animal parecido al tuyo',
    cuerpo: 'Mirá las fotos y decidí si es o no.',
  },
  coincidencia: {
    titulo: (elAnimal: string) => `Posible coincidencia con ${elAnimal}`,
    cuerpo: 'Tocá para ver las fotos.',
  },
  /** "Tenés un mensaje nuevo sobre Toby". Nunca el texto del mensaje ni quién lo mandó. */
  mensaje: {
    titulo: (elAnimal: string | null) =>
      elAnimal ? `Tenés un mensaje nuevo sobre ${elAnimal}` : 'Tenés un mensaje nuevo',
    cuerpo: 'Tocá para leerlo.',
  },
  /** "La familia de Toby te agradeció". Nunca el mensaje ni quién lo mandó. */
  agradecimiento: {
    titulo: (deAnimal: string) => `La familia ${deAnimal} te agradeció`,
    cuerpo: 'Gracias por ayudar a que volviera a casa.',
  },
  errorNuevo: { titulo: 'Llegó un reporte de un error', cuerpo: 'Tocá para verlo en moderación.' },
  errorResuelto: { titulo: 'Resolvimos el error que reportaste', cuerpo: 'Tocá para ver la respuesta.' },
  otro: { titulo: 'Tenés una novedad en Spot', cuerpo: 'Tocá para verla.' },
};

function mayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-UY') + texto.slice(1);
}

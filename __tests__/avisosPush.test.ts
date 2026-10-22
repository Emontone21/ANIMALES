import fs from 'fs';
import path from 'path';

import { t } from '@/i18n/es-UY';

import { TEXTOS } from '../supabase/functions/avisar/textos';

/**
 * Los textos de las notificaciones del celular: la función avisar no puede
 * importar de src/, así que tiene una copia (supabase/functions/avisar/textos.ts).
 */

type Texto = { titulo: string | ((valor: string | null) => string); cuerpo: string };

const ARGUMENTOS = ['a Toby', 'al perro', 'Toby', 'el gato', 'el animal'];
/** Los que aceptan null: sin nombre (coincidencia de la familia) o sin caso (mensaje). */
const CON_NULL = ['coincidenciaFamilia', 'mensaje'];

function salidas(clave: string, texto: Texto): string[] {
  const titulo = texto.titulo;
  const argumentos = CON_NULL.includes(clave) ? [...ARGUMENTOS, null] : ARGUMENTOS;
  const titulos = typeof titulo === 'function' ? argumentos.map((a) => titulo(a)) : [titulo];
  return [...titulos, texto.cuerpo];
}

describe('textos de las notificaciones del celular', () => {
  const app = t.avisosPush as unknown as Record<string, unknown>;
  const funcion = TEXTOS as unknown as Record<string, unknown>;

  test('la función tiene las mismas claves que es-UY', () => {
    expect(Object.keys(funcion).sort()).toEqual(Object.keys(app).sort());
  });

  test('dicen lo mismo, con y sin nombre', () => {
    expect(TEXTOS.animalA).toEqual(t.avisosPush.animalA);
    expect(TEXTOS.animalEl).toEqual(t.avisosPush.animalEl);
    for (const clave of Object.keys(app)) {
      if (clave === 'animalA' || clave === 'animalEl') continue;
      expect([clave, ...salidas(clave, funcion[clave] as Texto)]).toEqual([
        clave,
        ...salidas(clave, app[clave] as Texto),
      ]);
    }
  });

  test('voseo y sin datos de personas: ningún texto fijo nombra a alguien ni trae números', () => {
    for (const clave of Object.keys(app)) {
      if (clave === 'animalA' || clave === 'animalEl') continue;
      for (const frase of salidas(clave, app[clave] as Texto)) {
        expect(frase).not.toMatch(/\d|@|https?:|\btú\b|\btienes\b/i);
      }
    }
    expect(t.avisosPush.mensaje.titulo('Toby')).toBe('Tenés un mensaje nuevo sobre Toby');
    expect(t.avisosPush.visto.titulo('a Toby')).toBe('Alguien vio a Toby');
  });

  test('el título de respaldo del service worker es el nombre de la app', () => {
    const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
    expect(sw).toContain(`|| '${t.app.nombre}'`);
  });
});

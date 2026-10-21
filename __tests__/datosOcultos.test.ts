/**
 * Textos de la IA sin teléfonos, links ni emails (auditoría 2, S-M3). La
 * función reconocer los tapa (validar.ts) y la base los rechaza (migración
 * 0023). Lo que rechaza la base tiene que ser una parte de lo que tapa la
 * función: si no, una respuesta ya tapada chocaría con el check y la foto se
 * reintentaría en bucle.
 */
import {
  DATO_OCULTO,
  ocultarDatos,
  PATRONES_DE_LA_BASE,
} from '../supabase/functions/reconocer/validar';

// Sin tipos de Node en el proyecto: lo justo de fs. Jest corre desde la raíz del repo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync: (ruta: string, codificacion: 'utf8') => string };
const MIGRACION = fs.readFileSync(
  `${process.cwd()}/supabase/migrations/20261021000023_auditoria_2.sql`,
  'utf8',
);

/** La función de la base, sin los comentarios. */
const TIENE_DATOS = MIGRACION.slice(
  MIGRACION.indexOf('create or replace function public.tiene_datos_de_contacto(p_texto text)'),
  MIGRACION.indexOf('-- Una lista, con un separador'),
);

const BASE = [
  new RegExp(PATRONES_DE_LA_BASE.telefono),
  new RegExp(PATRONES_DE_LA_BASE.enlace, 'i'),
  new RegExp(PATRONES_DE_LA_BASE.email),
];
const laBaseLoRechaza = (texto: string) => BASE.some((r) => r.test(texto));

describe('datos de contacto en los textos de la IA', () => {
  test('la base usa los mismos patrones que declara la función', () => {
    expect(TIENE_DATOS).toContain(`p_texto ~ '${PATRONES_DE_LA_BASE.telefono}'`);
    expect(TIENE_DATOS).toContain(`p_texto ~* '${PATRONES_DE_LA_BASE.enlace}'`);
    expect(TIENE_DATOS).toContain(`p_texto ~ '${PATRONES_DE_LA_BASE.email}'`);
  });

  test('lo que tapa la función nunca lo rechaza la base', () => {
    const textos = [
      'Es Toby, llamá al 099 123 456',
      '+598 (99) 123-456 o 2900 1234',
      'escribí a toby.duenio@example.com o a josé@correo.example.org',
      'entrá a https://estafa.example/pago, WWW.TOBY.UY o wa.me/59899123456',
      'seguilo en toby.uy/fotos',
      '0 9 9 1 2 3 4',
      '12.345.678',
      'awww.algo',
      `${'9'.repeat(5)} ${DATO_OCULTO} ${'9'.repeat(5)}`,
    ];
    for (const texto of textos) {
      const limpio = ocultarDatos(texto);
      expect(limpio).toContain(DATO_OCULTO);
      expect(laBaseLoRechaza(limpio)).toBe(false);
    }
  });

  test('la base rechaza teléfonos, links y emails', () => {
    expect(laBaseLoRechaza('llamá al 099 123 456')).toBe(true);
    expect(laBaseLoRechaza('HTTPS://estafa.example')).toBe(true);
    expect(laBaseLoRechaza('wa.me/59899123456')).toBe(true);
    expect(laBaseLoRechaza('toby@correo.example')).toBe(true);
    // Un dominio suelto lo tapa la función, pero la base no lo busca.
    expect(laBaseLoRechaza('toby.uy/fotos')).toBe(false);
    expect(ocultarDatos('toby.uy/fotos')).toBe(DATO_OCULTO);
  });

  test('lo que describe al animal pasa tal cual', () => {
    for (const texto of [
      'Misma mancha blanca en el pecho y la oreja izquierda caída',
      'Tiene unos 3 años y pesa 12,5 kg',
      'collar rojo con chapita',
    ]) {
      expect(ocultarDatos(texto)).toBe(texto);
      expect(laBaseLoRechaza(texto)).toBe(false);
    }
  });
});

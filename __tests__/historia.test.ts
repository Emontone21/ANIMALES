import { ColorHistoria, type Esquema, paletas } from '@/constants/tema';
import {
  ALTO,
  ANCHO,
  colorDominante,
  CONTRASTE_FONDO,
  datosDeHistoria,
  deHex,
  disenioHistoria,
  type DisenioHistoria,
  fondoDeHistoria,
  nombreParaHistoria,
  type Rgb,
  textosDeHistoria,
} from '@/features/historias/disenio';
import { contraste } from '@/lib/contraste';

/** Un caso como llega de animales_detalle, con todo lo que NO puede ir en la imagen. */
const CASO = {
  id: '11111111-2222-4333-8444-555555555555',
  tipo_reporte: 'perdido' as const,
  estado: 'avistado' as const,
  nombre: 'Toby',
  especie: 'perro' as const,
  color: 'Marrón',
  tamanio: 'mediano' as const,
  tiene_collar: true,
  perdido_desde: '2026-10-17T15:00:00Z',
  created_at: '2026-10-18T12:00:00Z',
  descripcion: 'Se escapó por la calle Rivera, llamame al 099 123 456',
  contacto_familia: '099 123 456',
  creado_por_nombre: 'Carla Pérez',
  lat: -34.9011,
  lng: -56.1645,
};

const ESQUEMAS: Esquema[] = ['claro', 'oscuro'];

/** Colores de foto de todo tipo: una grilla del cubo RGB y los extremos. */
const COLORES: Rgb[] = [];
for (const r of [0, 64, 128, 192, 255]) {
  for (const g of [0, 64, 128, 192, 255]) {
    for (const b of [0, 64, 128, 192, 255]) COLORES.push([r, g, b]);
  }
}

function todosLosTextos(d: DisenioHistoria): string[] {
  return [d.etiqueta.texto.texto, ...d.textos.map((x) => x.texto)];
}

describe('la historia para compartir', () => {
  test('mide 1080 × 1920 y todo queda adentro, fuera de lo que tapa Instagram', () => {
    for (const esquema of ESQUEMAS) {
      const d = disenioHistoria(datosDeHistoria(CASO), esquema, [180, 120, 60]);
      expect([d.ancho, d.alto]).toEqual([1080, 1920]);
      expect([ANCHO, ALTO]).toEqual([1080, 1920]);
      const cajas = [
        { ...d.foto },
        { x: d.etiqueta.x, y: d.etiqueta.y, ancho: 400, alto: d.etiqueta.alto },
        { ...d.logo },
      ];
      for (const caja of cajas) {
        expect(caja.x).toBeGreaterThanOrEqual(0);
        expect(caja.x + caja.ancho).toBeLessThanOrEqual(ANCHO);
        expect(caja.y).toBeGreaterThanOrEqual(200);
        expect(caja.y + caja.alto).toBeLessThanOrEqual(1720);
      }
      for (const x of d.textos) {
        expect(x.x + x.maxAncho).toBeLessThanOrEqual(ANCHO);
        expect(x.y - x.tamanio).toBeGreaterThanOrEqual(d.foto.y + d.foto.alto);
        expect(x.y).toBeLessThan(d.logo.y);
      }
      // La foto va grande: casi todo el ancho.
      expect(d.foto.ancho).toBeGreaterThanOrEqual(900);
    }
  });

  test('el texto se lee con cualquier foto, en claro y en oscuro', () => {
    for (const esquema of ESQUEMAS) {
      for (const color of COLORES) {
        const d = disenioHistoria(datosDeHistoria(CASO), esquema, color);
        for (const x of [d.etiqueta.texto, ...d.textos]) {
          expect(x.sobre).toMatch(/^#[0-9A-F]{6}$/);
          expect(contraste(x.color, x.sobre)).toBeGreaterThanOrEqual(4.5);
        }
        for (const x of d.textos) {
          expect(x.sobre).toBe(d.fondo);
          expect(contraste(x.color, d.fondo)).toBeGreaterThanOrEqual(CONTRASTE_FONDO);
        }
      }
    }
  });

  test('el fondo es el color de la foto, aclarado (claro) u oscurecido (oscuro) lo justo', () => {
    // Siempre se separa un poco de la foto, aunque su color ya se lea.
    for (const esquema of ESQUEMAS) {
      expect(fondoDeHistoria([20, 40, 90], esquema)).not.toBe('#14285A');
      expect(fondoDeHistoria([120, 172, 108], esquema)).not.toBe('#78AC6C');
    }
    // Un amarillo fuerte en oscuro se oscurece; en claro se aclara a un pastel.
    const [r, g, b] = deHex(fondoDeHistoria([250, 210, 30], 'oscuro'));
    expect(r + g + b).toBeLessThan(250 + 210 + 30);
    expect(
      contraste(fondoDeHistoria([250, 210, 30], 'claro'), paletas.claro.texto),
    ).toBeGreaterThanOrEqual(CONTRASTE_FONDO);
    // Conserva el tono: un azul sigue siendo azul.
    const azul = deHex(fondoDeHistoria([30, 60, 200], 'claro'));
    expect(azul[2]).toBeGreaterThan(azul[0]);
  });

  test('sin foto que se pueda dibujar: el color de la especie y el recuadro vacío', () => {
    for (const especie of ['perro', 'gato', 'otro'] as const) {
      const d = disenioHistoria(datosDeHistoria({ ...CASO, especie }), 'claro', null);
      expect(d.conFoto).toBe(false);
      expect(d.fondo).toBe(fondoDeHistoria(deHex(ColorHistoria[especie]), 'claro'));
    }
    expect(disenioHistoria(datosDeHistoria(CASO), 'oscuro', [1, 2, 3]).conFoto).toBe(true);
  });

  test('textos de un perdido y de un encontrado', () => {
    expect(textosDeHistoria(datosDeHistoria(CASO))).toEqual({
      etiqueta: 'SE PERDIÓ',
      titulo: 'Toby',
      descripcion: 'Perro Marrón',
      fecha: 'Se perdió el 17 de octubre',
      ayuda: 'Ayudá a encontrarlo en Spot',
    });
    const encontrado = datosDeHistoria(
      { ...CASO, tipo_reporte: 'encontrado', nombre: null, especie: 'gato', color: 'gris' },
      '2026-10-16T22:00:00Z',
    );
    expect(textosDeHistoria(encontrado)).toEqual({
      etiqueta: 'ENCONTRADO',
      titulo: 'Gato',
      descripcion: 'Gris, mediano',
      // El día en Montevideo: 19 h del 16.
      fecha: 'Lo encontraron el 16 de octubre',
      ayuda: 'Ayudá a encontrar a su familia en Spot',
    });
    // Sin color ni tamaño, solo la especie.
    const pelado = datosDeHistoria({ ...CASO, nombre: null, color: null, tamanio: null });
    expect(textosDeHistoria(pelado).descripcion).toBeNull();
  });

  test('sin datos privados: ni contacto, ni descripción, ni quién publicó, ni dónde', () => {
    const datos = datosDeHistoria(CASO);
    expect(Object.keys(datos).sort()).toEqual(
      ['color', 'especie', 'fecha', 'nombre', 'tamanio', 'tipo'].sort(),
    );
    for (const esquema of ESQUEMAS) {
      const textos = todosLosTextos(disenioHistoria(datos, esquema, [100, 100, 100])).join(' | ');
      expect(textos).not.toMatch(/\d{3}|Rivera|llamame|Carla|Pérez|-34|-56/);
    }
  });

  test('un nombre o un color que parecen un contacto no entran', () => {
    expect(nombreParaHistoria('Toby')).toBe('Toby');
    for (const nombre of ['Toby 099123456', 'toby@correo.example', 'www.toby.uy', 'a'.repeat(31)]) {
      expect(nombreParaHistoria(nombre)).toBeNull();
    }
    const datos = datosDeHistoria({
      ...CASO,
      nombre: 'Llamar 099123456',
      color: 'negro 099 111 222',
    });
    expect(datos.nombre).toBeNull();
    expect(datos.color).toBeNull();
    expect(textosDeHistoria(datos).titulo).toBe('Perro');
  });
});

describe('el color dominante de la foto', () => {
  function imagen(pixeles: [Rgb, number][]): number[] {
    return pixeles.flatMap(([[r, g, b], cuantos]) =>
      Array.from({ length: cuantos }, () => [r, g, b, 255]).flat(),
    );
  }

  test('gana el color más presente, y lo saturado pesa más que el gris', () => {
    expect(
      colorDominante(
        imagen([
          [[200, 40, 40], 60],
          [[120, 120, 120], 40],
        ]),
      ),
    ).toEqual([200, 40, 40]);
    // Más gris que naranja, pero el naranja (el perro) gana.
    expect(
      colorDominante(
        imagen([
          [[220, 120, 30], 30],
          [[128, 128, 128], 60],
        ]),
      ),
    ).toEqual([220, 120, 30]);
  });

  test('el cielo casi blanco y las sombras casi negras cuentan poco', () => {
    expect(
      colorDominante(
        imagen([
          [[250, 250, 250], 70],
          [[90, 140, 60], 30],
        ]),
      ),
    ).toEqual([90, 140, 60]);
  });

  test('sin píxeles visibles, null (se usa el color de la especie)', () => {
    expect(colorDominante([])).toBeNull();
    expect(colorDominante([10, 20, 30, 0, 40, 50, 60, 0])).toBeNull();
  });
});

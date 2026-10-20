import type { MargenesMapa } from '@/components/mapa/tipos';
import { coloresDeEstado, paletas } from '@/constants/tema';
import {
  encuadrar,
  MARGEN_ENCUADRE_PX,
  metrosPorPixel,
  paradasRadioZona,
  RADIO_APROXIMADO_M,
  RADIO_MINIMO_ZONA_PX,
  type Vista,
  ZOOM_MAXIMO_ENCUADRE,
} from '@/features/mapa/encuadre';
import {
  esUbicacionAproximada,
  hayAnterior,
  haySiguiente,
  indiceVecino,
  ordenarRecorrido,
  recorridoGrandeAGeoJSON,
} from '@/features/mapa/recorrido';
import { contraste, masLegible } from '@/lib/contraste';
import { ZOOM_PUNTO } from '@/lib/ubicacion';
import type { LngLat, TipoAvistamiento } from '@/types/dominio';

const av = (id: string, minutos: number, tipo: TipoAvistamiento, lng = -56.17, lat = -34.9) => ({
  id,
  tipo,
  lng,
  lat,
  visto_en: new Date(Date.UTC(2026, 9, 20, 12, minutos)).toISOString(),
});

describe('orden y numeración del recorrido', () => {
  // Como los devuelve la API: el más nuevo primero.
  const avistamientos = [
    av('v3', 30, 'visto'),
    av('v2', 20, 'resguardado'),
    av('v1', 10, 'perdido'),
  ];

  test('del más viejo al más nuevo, numerados desde 1, con el último marcado', () => {
    const puntos = ordenarRecorrido(avistamientos);
    expect(puntos.map((p) => [p.avistamiento.id, p.orden, p.ultimo])).toEqual([
      ['v1', 1, false],
      ['v2', 2, false],
      ['v3', 3, true],
    ]);
  });

  test('dos en el mismo momento van por id, en cualquier orden de llegada', () => {
    const a = av('a', 10, 'visto');
    const b = av('b', 10, 'visto');
    expect(ordenarRecorrido([b, a]).map((p) => p.avistamiento.id)).toEqual(['a', 'b']);
    expect(ordenarRecorrido([a, b]).map((p) => p.avistamiento.id)).toEqual(['a', 'b']);
  });

  test('no cambia la lista que recibe', () => {
    const copia = [...avistamientos];
    ordenarRecorrido(avistamientos);
    expect(avistamientos).toEqual(copia);
  });

  test('un solo avistamiento es el 1 y el último', () => {
    expect(ordenarRecorrido([av('v1', 0, 'encontrado')])).toMatchObject([
      { orden: 1, ultimo: true },
    ]);
    expect(ordenarRecorrido([])).toEqual([]);
  });
});

describe('ubicaciones aproximadas', () => {
  test('son las que la base guarda redondeadas: donde se perdió y el resguardo', () => {
    expect(esUbicacionAproximada('perdido')).toBe(true);
    expect(esUbicacionAproximada('resguardado')).toBe(true);
    expect(esUbicacionAproximada('visto')).toBe(false);
    expect(esUbicacionAproximada('encontrado')).toBe(false);
  });

  test('cada punto lo sabe', () => {
    const puntos = ordenarRecorrido([
      av('v1', 10, 'perdido'),
      av('v2', 20, 'visto'),
      av('v3', 30, 'resguardado'),
    ]);
    expect(puntos.map((p) => p.aproximado)).toEqual([true, false, true]);
  });
});

describe('Anterior y Siguiente', () => {
  test('avanzan y retroceden de a uno', () => {
    expect(indiceVecino(1, 5, 1)).toBe(2);
    expect(indiceVecino(3, 5, -1)).toBe(2);
  });

  test('en las puntas se quedan donde están y se apagan', () => {
    expect(indiceVecino(0, 5, -1)).toBe(0);
    expect(indiceVecino(4, 5, 1)).toBe(4);
    expect(hayAnterior(0)).toBe(false);
    expect(haySiguiente(4, 5)).toBe(false);
    expect(hayAnterior(4)).toBe(true);
    expect(haySiguiente(0, 5)).toBe(true);
  });

  test('con un solo punto no hay a dónde ir', () => {
    expect(indiceVecino(0, 1, 1)).toBe(0);
    expect(hayAnterior(0)).toBe(false);
    expect(haySiguiente(0, 1)).toBe(false);
    expect(indiceVecino(0, 0, 1)).toBe(0);
  });
});

describe('GeoJSON del mapa en grande', () => {
  const puntos = ordenarRecorrido([
    av('v2', 20, 'visto', -56.18, -34.91),
    av('v1', 10, 'perdido', -56.17, -34.9),
  ]);

  test('la línea va primero y en orden; cada punto con su número y la selección', () => {
    const { features } = recorridoGrandeAGeoJSON(puntos, 'v2');
    expect(features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-56.17, -34.9],
        [-56.18, -34.91],
      ],
    });
    expect(features.slice(1).map((f) => f.properties)).toEqual([
      { id: 'v1', orden: 1, ultimo: false, aproximado: true, seleccionado: false },
      { id: 'v2', orden: 2, ultimo: true, aproximado: false, seleccionado: true },
    ]);
  });

  test('con un solo punto no hay línea', () => {
    const { features } = recorridoGrandeAGeoJSON(puntos.slice(0, 1), null);
    expect(features.map((f) => f.geometry.type)).toEqual(['Point']);
  });
});

describe('vista inicial', () => {
  const SIN_MARGENES: MargenesMapa = { top: 0, right: 0, bottom: 0, left: 0 };
  const celular: Vista = {
    ancho: 390,
    alto: 844,
    // Los botones de arriba y la tarjeta de abajo.
    margenes: { top: 112, right: 0, bottom: 260, left: 0 },
  };

  /** Dónde cae un punto en la pantalla con ese encuadre (Web Mercator de 512). */
  function enPantalla(punto: LngLat, centro: LngLat, zoom: number, vista: Vista): [number, number] {
    const mercator = ([lng, lat]: LngLat) => [
      (lng + 180) / 360,
      (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2,
    ];
    const escala = 512 * 2 ** zoom;
    const [px, py] = mercator(punto);
    const [cx, cy] = mercator(centro);
    const { ancho, alto, margenes: m } = vista;
    const medioX = m.left + (ancho - m.left - m.right) / 2;
    const medioY = m.top + (alto - m.top - m.bottom) / 2;
    return [medioX + (px - cx) * escala, medioY + (py - cy) * escala];
  }

  function entraEnLoVisible(punto: LngLat, radioPx: number, centro: LngLat, zoom: number) {
    const [x, y] = enPantalla(punto, centro, zoom, celular);
    const m = celular.margenes;
    const tolerancia = 0.5;
    expect(x - radioPx).toBeGreaterThanOrEqual(m.left + MARGEN_ENCUADRE_PX - tolerancia);
    expect(x + radioPx).toBeLessThanOrEqual(
      celular.ancho - m.right - MARGEN_ENCUADRE_PX + tolerancia,
    );
    expect(y - radioPx).toBeGreaterThanOrEqual(m.top + MARGEN_ENCUADRE_PX - tolerancia);
    expect(y + radioPx).toBeLessThanOrEqual(
      celular.alto - m.bottom - MARGEN_ENCUADRE_PX + tolerancia,
    );
  }

  test('un solo avistamiento se centra con ZOOM_PUNTO', () => {
    const punto: LngLat = [-56.17, -34.9];
    expect(encuadrar([{ lngLat: punto, aproximado: true }], celular)).toEqual({
      centro: punto,
      zoom: ZOOM_PUNTO,
    });
  });

  test('varios en el mismo lugar cuentan como uno', () => {
    const punto: LngLat = [-56.17, -34.9];
    const vista = encuadrar(
      [
        { lngLat: punto, aproximado: false },
        { lngLat: [...punto], aproximado: true },
      ],
      celular,
    );
    expect(vista).toEqual({ centro: punto, zoom: ZOOM_PUNTO });
  });

  test('sin puntos no hay vista', () => {
    expect(encuadrar([], celular)).toBeNull();
  });

  test('varios entran todos en lo que se ve, con margen, y el más justo toca el margen', () => {
    const puntos: LngLat[] = [
      [-56.18, -34.905],
      [-56.165, -34.9],
      [-56.15, -34.912],
    ];
    const vista = encuadrar(
      puntos.map((lngLat) => ({ lngLat, aproximado: false })),
      celular,
    );
    expect(vista).not.toBeNull();
    const { centro, zoom } = vista!;
    expect(zoom).toBeLessThan(ZOOM_MAXIMO_ENCUADRE);
    for (const punto of puntos) entraEnLoVisible(punto, 0, centro, zoom);
    // De oeste a este ocupa todo el ancho libre: no queda más lejos de lo necesario.
    const [oeste] = enPantalla(puntos[0], centro, zoom, celular);
    const [este] = enPantalla(puntos[2], centro, zoom, celular);
    expect(este - oeste).toBeCloseTo(celular.ancho - 2 * MARGEN_ENCUADRE_PX, 0);
  });

  test('las zonas de los aproximados entran enteras', () => {
    const perdido: LngLat = [-56.17, -34.9];
    const visto: LngLat = [-56.168, -34.901];
    const vista = encuadrar(
      [
        { lngLat: perdido, aproximado: true },
        { lngLat: visto, aproximado: false },
      ],
      celular,
    )!;
    const radioPx = RADIO_APROXIMADO_M / metrosPorPixel(perdido[1], vista.zoom);
    entraEnLoVisible(perdido, radioPx, vista.centro, vista.zoom);
    entraEnLoVisible(visto, 0, vista.centro, vista.zoom);
  });

  test('dos puntos pegados no acercan más que el zoom máximo', () => {
    const vista = encuadrar(
      [
        { lngLat: [-56.17, -34.9], aproximado: false },
        { lngLat: [-56.17005, -34.90002], aproximado: false },
      ],
      { ancho: 1280, alto: 800, margenes: SIN_MARGENES },
    );
    expect(vista?.zoom).toBe(ZOOM_MAXIMO_ENCUADRE);
  });

  test('con una ventana mínima no da un zoom negativo', () => {
    const vista = encuadrar(
      [
        { lngLat: [-56.17, -34.9], aproximado: false },
        { lngLat: [-54.9, -34.95], aproximado: false },
      ],
      { ancho: 50, alto: 50, margenes: { top: 40, right: 0, bottom: 40, left: 0 } },
    );
    expect(vista!.zoom).toBeGreaterThanOrEqual(0);
  });
});

describe('zona de un punto aproximado', () => {
  const MONTEVIDEO_LAT = -34.9;
  // Interpolación exponencial de base 2 de MapLibre entre dos paradas.
  function radioEn(zoom: number, paradas: [number, number][]): number {
    for (let i = 0; i < paradas.length - 1; i++) {
      const [z0, r0] = paradas[i];
      const [z1, r1] = paradas[i + 1];
      if (zoom >= z0 && zoom <= z1) {
        const t = (2 ** (zoom - z0) - 1) / (2 ** (z1 - z0) - 1);
        return r0 + t * (r1 - r0);
      }
    }
    throw new Error('fuera de las paradas');
  }

  test('mide 110 m en el mapa, de cerca y en zooms intermedios', () => {
    const paradas = paradasRadioZona(MONTEVIDEO_LAT);
    for (const zoom of [14, 15, 15.5, 17, 19.25]) {
      const metros = radioEn(zoom, paradas) * metrosPorPixel(MONTEVIDEO_LAT, zoom);
      expect(metros).toBeCloseTo(RADIO_APROXIMADO_M, 6);
    }
  });

  test('de lejos no se achica más que el mínimo', () => {
    const paradas = paradasRadioZona(MONTEVIDEO_LAT);
    expect(radioEn(0, paradas)).toBe(RADIO_MINIMO_ZONA_PX);
    expect(radioEn(11.5, paradas)).toBe(RADIO_MINIMO_ZONA_PX);
    // Las paradas van en orden, como pide MapLibre.
    const zooms = paradas.map(([zoom]) => zoom);
    expect([...zooms].sort((a, b) => a - b)).toEqual(zooms);
  });

  test('cubre el error del redondeo a 3 decimales', () => {
    // El peor caso: medio milésimo de grado en latitud y en longitud.
    const metrosGrado = (2 * Math.PI * 6_378_137) / 360;
    const errorLat = 0.0005 * metrosGrado;
    const errorLng = 0.0005 * metrosGrado * Math.cos((MONTEVIDEO_LAT * Math.PI) / 180);
    expect(Math.hypot(errorLat, errorLng)).toBeLessThan(RADIO_APROXIMADO_M);
  });
});

describe('número de cada punto', () => {
  test('se lee sobre todos los colores de punto, en claro y en oscuro (4,5:1)', () => {
    for (const c of Object.values(paletas)) {
      const opciones = [c.texto, c.textoInverso, c.textoSobrePrimario];
      const fondos = [
        c.puntoInactivo,
        coloresDeEstado(c, 'avistado', 'encontrado').anillo,
        coloresDeEstado(c, 'avistado', 'perdido').anillo,
        coloresDeEstado(c, 'reunido', 'perdido').anillo,
      ];
      for (const fondo of fondos) {
        expect(contraste(fondo, masLegible(fondo, opciones))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('el contraste da los valores de referencia', () => {
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contraste('#777777', '#777777')).toBe(1);
    // Botón primario en claro (docs/DISENO.md, 2.4).
    expect(contraste(paletas.claro.primario, paletas.claro.textoSobrePrimario)).toBeCloseTo(5.9, 1);
  });
});

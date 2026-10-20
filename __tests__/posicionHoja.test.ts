import {
  desplazamientoAlArrastrar,
  desplazamientoHoja,
  esArrastreVertical,
  plegadaAlSoltar,
} from '@/features/mapa/posicionHoja';
import { anotarRuta, olvidarRutas, pantallaAnterior } from '@/lib/rutasRecientes';

// Una hoja abierta de 300 que plegada queda en 75: baja 225.
const RECORRIDO = 225;

describe('hoja "Cerca tuyo" plegable', () => {
  test('abierta no se mueve; plegada baja todo el recorrido', () => {
    expect(desplazamientoHoja(false, RECORRIDO)).toBe(0);
    expect(desplazamientoHoja(true, RECORRIDO)).toBe(RECORRIDO);
    // Sin casos no hay nada que plegar.
    expect(desplazamientoHoja(true, 0)).toBe(0);
  });

  test('al arrastrar sigue al dedo sin pasarse de las dos posiciones', () => {
    expect(desplazamientoAlArrastrar(false, 100, RECORRIDO)).toBe(100);
    expect(desplazamientoAlArrastrar(false, -50, RECORRIDO)).toBe(0);
    expect(desplazamientoAlArrastrar(false, 900, RECORRIDO)).toBe(RECORRIDO);
    expect(desplazamientoAlArrastrar(true, -100, RECORRIDO)).toBe(RECORRIDO - 100);
    expect(desplazamientoAlArrastrar(true, 40, RECORRIDO)).toBe(RECORRIDO);
  });

  test('al soltar despacio, va a la posición más cercana', () => {
    const soltar = (plegadaAlEmpezar: boolean, dy: number) =>
      plegadaAlSoltar({ plegadaAlEmpezar, dy, vy: 0.1, recorrido: RECORRIDO });
    expect(soltar(false, 50)).toBe(false);
    expect(soltar(false, 120)).toBe(true);
    expect(soltar(true, -50)).toBe(true);
    expect(soltar(true, -120)).toBe(false);
  });

  test('un gesto rápido manda la dirección, aunque sea corto', () => {
    expect(
      plegadaAlSoltar({ plegadaAlEmpezar: false, dy: 30, vy: 1.2, recorrido: RECORRIDO }),
    ).toBe(true);
    expect(
      plegadaAlSoltar({ plegadaAlEmpezar: true, dy: -30, vy: -1.2, recorrido: RECORRIDO }),
    ).toBe(false);
    // Rápido hacia arriba estando abierta: sigue abierta.
    expect(
      plegadaAlSoltar({ plegadaAlEmpezar: false, dy: -30, vy: -2, recorrido: RECORRIDO }),
    ).toBe(false);
  });

  test('sin recorrido (sin casos), no cambia', () => {
    expect(plegadaAlSoltar({ plegadaAlEmpezar: false, dy: 200, vy: 3, recorrido: 0 })).toBe(false);
  });

  test('solo un movimiento vertical mueve la hoja (no un toque ni un desliz al costado)', () => {
    expect(esArrastreVertical(0, 4)).toBe(false);
    expect(esArrastreVertical(0, 12)).toBe(true);
    expect(esArrastreVertical(30, 12)).toBe(false);
    expect(esArrastreVertical(2, -20)).toBe(true);
  });
});

describe('la pantalla anterior para "Reportar un error"', () => {
  beforeEach(olvidarRutas);

  test('la última distinta de Perfil', () => {
    anotarRuta('/');
    anotarRuta('/animal/123');
    anotarRuta('/perfil');
    expect(pantallaAnterior()).toBe('/animal/123');
  });

  test('si se entró directo a Perfil, ninguna', () => {
    anotarRuta('/perfil');
    expect(pantallaAnterior()).toBeNull();
  });

  test('guarda solo las últimas 10, sin repetir la misma seguida', () => {
    for (let i = 0; i < 15; i++) anotarRuta(`/animal/${i}`);
    anotarRuta('/animal/14');
    anotarRuta('/perfil');
    expect(pantallaAnterior()).toBe('/animal/14');
    expect(pantallaAnterior('/animal/14')).toBe('/perfil');
  });
});

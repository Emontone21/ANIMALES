import { t } from '@/i18n/es-UY';
import { distanciaMetros } from '@/lib/ubicacion';
import type { AnimalEnMapa, Especie, EstadoAnimal, LngLat } from '@/types/dominio';

/** Filtros del mapa. Se aplican en el cliente sobre la lista ya cargada. */

export type FiltroEspecie = 'todas' | Especie;
export type FiltroEstado = 'activos' | EstadoAnimal;
export type FiltroAntiguedad = '24h' | '7d' | '30d' | 'todo';

export type FiltrosMapa = {
  especie: FiltroEspecie;
  estado: FiltroEstado;
  antiguedad: FiltroAntiguedad;
};

export const FILTROS_INICIALES: FiltrosMapa = {
  especie: 'todas',
  estado: 'activos',
  antiguedad: '30d',
};

export const OPCIONES_ESPECIE: { valor: FiltroEspecie; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: t.mapa.filtros.todos },
  { valor: 'perro', etiqueta: t.especiePlural.perro },
  { valor: 'gato', etiqueta: t.especiePlural.gato },
  { valor: 'otro', etiqueta: t.especiePlural.otro },
];

/** Chips flotantes sobre el mapa (antes de la Fase 6): Todos, Perros, Gatos. */
export const OPCIONES_RAPIDAS = OPCIONES_ESPECIE.filter((opcion) => opcion.valor !== 'otro');

export const OPCIONES_ESTADO: { valor: FiltroEstado; etiqueta: string }[] = [
  { valor: 'activos', etiqueta: t.mapa.filtros.activos },
  { valor: 'avistado', etiqueta: t.estado.avistado },
  { valor: 'resguardado', etiqueta: t.estado.resguardado },
  { valor: 'reunido', etiqueta: t.estado.reunido },
];

export const OPCIONES_ANTIGUEDAD: { valor: FiltroAntiguedad; etiqueta: string }[] = [
  { valor: '24h', etiqueta: t.mapa.filtros.ultimas24h },
  { valor: '7d', etiqueta: t.mapa.filtros.ultimos7d },
  { valor: '30d', etiqueta: t.mapa.filtros.ultimos30d },
  { valor: 'todo', etiqueta: t.mapa.filtros.todos },
];

const HORAS_POR_ANTIGUEDAD: Record<FiltroAntiguedad, number | null> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  todo: null,
};

export function aplicarFiltros(
  animales: AnimalEnMapa[],
  filtros: FiltrosMapa,
  ahora: Date = new Date(),
): AnimalEnMapa[] {
  const horas = HORAS_POR_ANTIGUEDAD[filtros.antiguedad];
  const limite = horas === null ? null : ahora.getTime() - horas * 3_600_000;

  return animales.filter((a) => {
    if (filtros.especie !== 'todas' && a.especie !== filtros.especie) return false;

    if (filtros.estado === 'activos') {
      if (a.estado !== 'avistado' && a.estado !== 'resguardado') return false;
    } else if (a.estado !== filtros.estado) {
      return false;
    }

    if (limite !== null) {
      const ultimo = new Date(a.ultimo_avistamiento_en ?? a.ultimo_visto_en).getTime();
      if (ultimo < limite) return false;
    }
    return true;
  });
}

export type CasoCercano = {
  animal: AnimalEnMapa;
  /** Distancia al centro del mapa, o null si todavía no se conoce el centro. */
  km: number | null;
};

/**
 * Casos ordenados por distancia al centro del mapa (se calcula en el cliente).
 * El seleccionado en el mapa va primero.
 */
export function ordenarPorCercania(
  animales: AnimalEnMapa[],
  centro: LngLat | null,
  primeroId: string | null = null,
): CasoCercano[] {
  const casos = animales.map((animal) => ({
    animal,
    km: centro ? distanciaMetros(centro, [animal.lng, animal.lat]) / 1000 : null,
  }));
  return casos.sort((a, b) => {
    if (a.animal.id === primeroId) return -1;
    if (b.animal.id === primeroId) return 1;
    return (a.km ?? 0) - (b.km ?? 0);
  });
}

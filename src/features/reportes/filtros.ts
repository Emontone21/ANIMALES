import { create } from 'zustand';

import { t } from '@/i18n/es-UY';
import { distanciaMetros, MONTEVIDEO } from '@/lib/ubicacion';
import type { AnimalEnMapa, Especie, EstadoAnimal, LngLat, TipoReporte } from '@/types/dominio';

/** Filtros del mapa. Se aplican en el cliente sobre la lista ya cargada. */

export type FiltroTipo = 'todos' | TipoReporte;
export type FiltroEspecie = 'todas' | Especie;
export type FiltroEstado = 'activos' | EstadoAnimal;
export type FiltroAntiguedad = '24h' | '7d' | '30d' | 'todo';

export type FiltrosMapa = {
  tipo: FiltroTipo;
  especie: FiltroEspecie;
  estado: FiltroEstado;
  antiguedad: FiltroAntiguedad;
};

export const FILTROS_INICIALES: FiltrosMapa = {
  tipo: 'todos',
  especie: 'todas',
  estado: 'activos',
  antiguedad: '30d',
};

type EstadoFiltros = {
  filtros: FiltrosMapa;
  /** Centro del mapa la última vez que dejó de moverse: de ahí se miden las distancias. */
  centro: LngLat;
  setFiltros: (filtros: FiltrosMapa) => void;
  setCentro: (centro: LngLat) => void;
};

/**
 * Filtros y centro del mapa, compartidos con la lista de casos ("Ver lista"):
 * la lista muestra lo mismo que el mapa y, si se cambia un filtro ahí, el mapa
 * también cambia. Viven en memoria: al recargar, vuelven a los iniciales.
 */
export const useFiltrosMapa = create<EstadoFiltros>()((set) => ({
  filtros: FILTROS_INICIALES,
  centro: MONTEVIDEO,
  setFiltros: (filtros) => set({ filtros }),
  setCentro: (centro) => set({ centro }),
}));

export const OPCIONES_ESPECIE: { valor: FiltroEspecie; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: t.mapa.filtros.todos },
  { valor: 'perro', etiqueta: t.especiePlural.perro },
  { valor: 'gato', etiqueta: t.especiePlural.gato },
  { valor: 'otro', etiqueta: t.especiePlural.otro },
];

/**
 * Chips flotantes sobre el mapa: Todos, Perdidos, Encontrados (docs/DISENO.md,
 * 7.1), con el punto del color de cada tipo. La especie queda en la hoja de filtros.
 */
export const OPCIONES_TIPO: { valor: FiltroTipo; etiqueta: string; punto?: TipoReporte }[] = [
  { valor: 'todos', etiqueta: t.mapa.filtros.todos },
  { valor: 'perdido', etiqueta: t.mapa.filtros.perdidos, punto: 'perdido' },
  { valor: 'encontrado', etiqueta: t.mapa.filtros.encontrados, punto: 'encontrado' },
];

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
    if (filtros.tipo !== 'todos' && a.tipo_reporte !== filtros.tipo) return false;
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

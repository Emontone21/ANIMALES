import type { QueryClient } from '@tanstack/react-query';

import {
  clavesReportes,
  listarAnimalesMapa,
  listarAvistamientos,
  listarCambiosEstado,
  obtenerAnimal,
} from '@/features/reportes/api';
import { clavesReencuentros } from '@/features/reencuentros/claves';
import { type HistoriaPublica, obtenerHistoria } from '@/features/reencuentros/historia';
import { urlFoto, urlMediana } from '@/lib/imagenes';
import { precargarImagen } from '@/lib/precargar';
import type { AnimalDetalle } from '@/types/dominio';

export type ConsultaInicial =
  { tipo: 'mapa' } | { tipo: 'caso'; id: string } | { tipo: 'historia'; id: string } | null;

/**
 * Qué datos muestra la ruta con la que se entra a la app: el mapa (/ y /casos),
 * un caso (/animal/<id>) o la historia de un reencuentro (/reencuentros/<id>),
 * los links que se comparten. El resto no se adelanta.
 */
export function consultaInicial(ruta: string): ConsultaInicial {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  if (limpia === '/' || limpia === '/casos') return { tipo: 'mapa' };
  const caso = /^\/animal\/([^/]+)$/.exec(limpia);
  const historia = /^\/reencuentros\/([^/]+)$/.exec(limpia);
  const encontrado = caso ?? historia;
  if (!encontrado) return null;
  try {
    return { tipo: caso ? 'caso' : 'historia', id: decodeURIComponent(encontrado[1]) };
  } catch {
    return null;
  }
}

/**
 * Solo web, al arrancar: pide los datos de la ruta de entrada sin esperar a que
 * carguen sus pantallas ni el mapa. Las pantallas usan las mismas claves, así
 * que reciben el pedido en curso o el resultado. En un caso, apenas se sabe su
 * foto principal, se empieza a bajar con prioridad alta.
 */
export function precargarRutaInicial(queryClient: QueryClient, ruta: string): void {
  const consulta = consultaInicial(ruta);
  if (!consulta) return;
  if (consulta.tipo === 'mapa') {
    void queryClient.prefetchQuery({ queryKey: clavesReportes.mapa, queryFn: listarAnimalesMapa });
    return;
  }
  if (consulta.tipo === 'historia') {
    const { id } = consulta;
    void queryClient
      .prefetchQuery({
        queryKey: clavesReencuentros.historia(id),
        queryFn: () => obtenerHistoria(id),
      })
      .then(() => {
        const historia = queryClient.getQueryData<HistoriaPublica | null>(
          clavesReencuentros.historia(id),
        );
        if (historia?.foto_path) precargarImagen(urlMediana(historia.foto_path));
      });
    return;
  }
  const { id } = consulta;
  void queryClient
    .prefetchQuery({ queryKey: clavesReportes.animal(id), queryFn: () => obtenerAnimal(id) })
    .then(() => {
      const animal = queryClient.getQueryData<AnimalDetalle | null>(clavesReportes.animal(id));
      if (animal?.foto_principal_path) precargarImagen(urlFoto(animal.foto_principal_path));
    });
  void queryClient.prefetchQuery({
    queryKey: clavesReportes.avistamientos(id),
    queryFn: () => listarAvistamientos(id),
  });
  void queryClient.prefetchQuery({
    queryKey: clavesReportes.cambiosEstado(id),
    queryFn: () => listarCambiosEstado(id),
  });
}

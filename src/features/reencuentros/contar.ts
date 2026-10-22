import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { clavesNotificaciones } from '@/features/notificaciones/api';
import { clavesReencuentros } from '@/features/reencuentros/claves';
import type { FotoElegida } from '@/hooks/useElegirFoto';
import { borrarFotos, comprimirYSubir } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/**
 * "Contá cómo volvió" (/animal/<id>/reencuentro): la historia de la familia y
 * los agradecimientos. Solo lo usa esa pantalla, que va en su propio bloque.
 */

export type MiHistoria = Pick<
  Database['public']['Tables']['historias_reencuentro']['Row'],
  'animal_id' | 'foto_path' | 'frase' | 'mostrar_nombre' | 'oculta'
>;

export type Participante =
  Database['public']['Functions']['participantes_del_caso']['Returns'][number];

/** La historia que ya contó la familia (la tabla la deja leer solo a ella), o null. */
export async function leerMiHistoria(
  animalId: string,
  usuarioId: string,
): Promise<MiHistoria | null> {
  const { data, error } = await supabase
    .from('historias_reencuentro')
    .select('animal_id, foto_path, frase, mostrar_nombre, oculta')
    .eq('animal_id', animalId)
    .eq('familia_id', usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Quiénes participaron en el caso, con el nombre público (solo la familia). */
export async function listarParticipantes(animalId: string): Promise<Participante[]> {
  const { data, error } = await supabase.rpc('participantes_del_caso', { p_animal_id: animalId });
  if (error) throw error;
  return data;
}

/** La foto que queda: la que ya tenía, una nueva o la del caso (null). */
export type FotoDeLaHistoria =
  { tipo: 'actual'; ruta: string } | { tipo: 'nueva'; foto: FotoElegida } | { tipo: 'delCaso' };

export type CambiosReencuentro = {
  /** Vacía: no se toca la historia (solo se agradece). */
  frase: string;
  mostrarNombre: boolean;
  foto: FotoDeLaHistoria;
  /** A quiénes agradecerle (los que todavía no). */
  agradecer: string[];
  mensaje: string;
};

export type ResultadoReencuentro = { historia: boolean; agradecidos: number };

export function useMiHistoria(animalId: string, usuarioId: string | undefined) {
  return useQuery({
    queryKey: clavesReencuentros.mia(animalId),
    queryFn: () => leerMiHistoria(animalId, usuarioId as string),
    enabled: !!usuarioId,
  });
}

export function useParticipantes(animalId: string, habilitado: boolean) {
  return useQuery({
    queryKey: clavesReencuentros.participantes(animalId),
    queryFn: () => listarParticipantes(animalId),
    enabled: habilitado,
  });
}

/**
 * Guarda la historia (si hay frase) y después agradece. La foto nueva se sube
 * una sola vez: si algo falla y se reintenta, se usa la ya subida. Los archivos
 * de la foto anterior se borran después; si eso falla, la historia ya quedó y
 * solo sobra un archivo que nada usa.
 */
export function useGuardarReencuentro(animalId: string, usuarioId: string) {
  const queryClient = useQueryClient();
  const subida = useRef<{ uri: string; ruta: string } | null>(null);
  return useMutation({
    mutationFn: async (cambios: CambiosReencuentro): Promise<ResultadoReencuentro> => {
      let historia = false;
      if (cambios.frase.trim()) {
        let ruta: string | null = null;
        if (cambios.foto.tipo === 'actual') ruta = cambios.foto.ruta;
        if (cambios.foto.tipo === 'nueva') {
          const { foto } = cambios.foto;
          if (subida.current?.uri !== foto.uri) {
            subida.current = {
              uri: foto.uri,
              ruta: await comprimirYSubir(foto.uri, foto.width, usuarioId),
            };
          }
          ruta = subida.current.ruta;
        }
        const { data: anteriores, error } = await supabase.rpc('guardar_historia_reencuentro', {
          p_animal_id: animalId,
          p_frase: cambios.frase.trim(),
          p_mostrar_nombre: cambios.mostrarNombre,
          p_foto_path: ruta,
        });
        if (error) throw error;
        historia = true;
        if (anteriores.length > 0) await borrarFotos(anteriores).catch(() => {});
      }
      let agradecidos = 0;
      if (cambios.agradecer.length > 0) {
        const { data, error } = await supabase.rpc('agradecer', {
          p_animal_id: animalId,
          p_usuarios: cambios.agradecer,
          p_mensaje: cambios.mensaje.trim() || null,
        });
        if (error) throw error;
        agradecidos = data;
      }
      return { historia, agradecidos };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: clavesReencuentros.todo });
      void queryClient.invalidateQueries({ queryKey: clavesNotificaciones.lista });
    },
  });
}

/** Primero las fotos (con la API de Storage), después la historia: como un reporte. */
export function useBorrarHistoria(animalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: fotos, error } = await supabase.rpc('fotos_de_la_historia', {
        p_animal_id: animalId,
      });
      if (error) throw error;
      if (fotos.length > 0) await borrarFotos(fotos);
      const { error: errorBorrar } = await supabase.rpc('borrar_historia_reencuentro', {
        p_animal_id: animalId,
      });
      if (errorBorrar) throw errorBorrar;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: clavesReencuentros.todo }),
  });
}

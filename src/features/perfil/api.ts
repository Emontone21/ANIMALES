import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { comprimirYSubir, conVariantes } from '@/lib/fotos';
import { BUCKET_FOTOS } from '@/lib/imagenes';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/types/dominio';

/** Las columnas que la API deja leer de perfiles (desde la 0011, "*" falla). */
const COLUMNAS_PERFIL = 'id, nombre_publico, avatar_path, es_moderador, created_at, updated_at';

const clavePerfil = (id: string) => ['perfil', id] as const;

export async function obtenerPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select(COLUMNAS_PERFIL)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type CambiosPerfil = {
  nombre: string;
  /** Foto nueva elegida (sin comprimir), o null para quitarla. undefined: no cambia. */
  foto?: { uri: string; width: number } | null;
};

/**
 * Guarda el nombre y la foto de perfil. La foto se comprime como las de los
 * casos y se sube a fotos/<uid>/ con su miniatura; la anterior se borra con la
 * API de Storage.
 */
export async function actualizarPerfil(perfil: Perfil, cambios: CambiosPerfil): Promise<void> {
  let avatarPath = perfil.avatar_path;
  if (cambios.foto) {
    avatarPath = await comprimirYSubir(cambios.foto.uri, cambios.foto.width, perfil.id);
  } else if (cambios.foto === null) {
    avatarPath = null;
  }

  const { error } = await supabase
    .from('perfiles')
    .update({ nombre_publico: cambios.nombre.trim(), avatar_path: avatarPath })
    .eq('id', perfil.id);
  if (error) throw error;

  // La foto vieja (y su miniatura, si la tiene) ya no la usa nadie. Si no se
  // puede borrar, el perfil igual quedó bien.
  if (perfil.avatar_path && perfil.avatar_path !== avatarPath) {
    await supabase.storage.from(BUCKET_FOTOS).remove(conVariantes([perfil.avatar_path]));
  }
}

export function usePerfil(id: string | null | undefined) {
  return useQuery({
    queryKey: clavePerfil(id ?? ''),
    queryFn: () => obtenerPerfil(id as string),
    enabled: Boolean(id),
  });
}

export function useActualizarPerfil(perfil: Perfil | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: CambiosPerfil) => {
      if (!perfil) throw new Error('Sin perfil');
      return actualizarPerfil(perfil, cambios);
    },
    onSuccess: () => {
      if (perfil) void queryClient.invalidateQueries({ queryKey: clavePerfil(perfil.id) });
    },
  });
}

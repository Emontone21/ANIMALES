import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { t } from '@/i18n/es-UY';

export type FotoElegida = { uri: string; width: number; height: number };

const OPCIONES_BASE: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
  allowsEditing: false,
  exif: false,
};

/**
 * Sacar una foto o elegirla de la galería, pidiendo el permiso que haga falta.
 * En web, los dos abren el selector de archivos del navegador.
 */
export function useElegirFoto(
  onCambio: (foto: FotoElegida) => void,
  opciones: Partial<ImagePicker.ImagePickerOptions> = {},
) {
  const [aviso, setAviso] = useState<string | null>(null);
  const opcionesFinales = { ...OPCIONES_BASE, ...opciones };

  const procesar = (resultado: ImagePicker.ImagePickerResult) => {
    if (resultado.canceled) return;
    const activo = resultado.assets[0];
    if (!activo) return;
    setAviso(null);
    onCambio({ uri: activo.uri, width: activo.width, height: activo.height });
  };

  const sacarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setAviso(t.publicar.permisoCamara);
      return;
    }
    procesar(await ImagePicker.launchCameraAsync(opcionesFinales));
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setAviso(t.publicar.permisoGaleria);
      return;
    }
    procesar(await ImagePicker.launchImageLibraryAsync(opcionesFinales));
  };

  return { aviso, sacarFoto, elegirDeGaleria };
}

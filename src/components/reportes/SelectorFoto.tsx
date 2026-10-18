import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

export type FotoElegida = { uri: string; width: number; height: number };

type Props = {
  foto: FotoElegida | null;
  onCambio: (foto: FotoElegida) => void;
  error?: string | null;
};

const OPCIONES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
  allowsEditing: false,
  exif: false,
};

/** Elegir la foto del animal con la cámara o desde la galería, con vista previa. */
export function SelectorFoto({ foto, onCambio, error }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

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
    procesar(await ImagePicker.launchCameraAsync(OPCIONES));
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setAviso(t.publicar.permisoGaleria);
      return;
    }
    procesar(await ImagePicker.launchImageLibraryAsync(OPCIONES));
  };

  return (
    <View style={estilos.contenedor}>
      <Texto variante="secundario" style={estilos.etiqueta}>
        {t.publicar.foto}
      </Texto>
      {foto ? (
        <Image source={{ uri: foto.uri }} style={estilos.vistaPrevia} contentFit="cover" />
      ) : (
        <View style={[estilos.vistaPrevia, estilos.vacio, error ? estilos.conError : null]}>
          <Ionicons name="paw-outline" size={48} color={Colores.textoSecundario} />
        </View>
      )}
      <View style={estilos.botones}>
        <Boton
          titulo={foto ? t.publicar.cambiarFoto : t.publicar.sacarFoto}
          icono="camera"
          variante={foto ? 'secundario' : 'primario'}
          onPress={() => void sacarFoto()}
          style={estilos.boton}
        />
        <Boton
          titulo={t.publicar.elegirGaleria}
          icono="images"
          variante="secundario"
          onPress={() => void elegirDeGaleria()}
          style={estilos.boton}
        />
      </View>
      {aviso ? <Mensaje texto={aviso} tipo="info" /> : null}
      {error ? (
        <Texto variante="pequeno" style={estilos.error}>
          {error}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Espacio.s },
  etiqueta: { fontWeight: '600' },
  vistaPrevia: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radio.m,
    backgroundColor: Colores.fondoSuave,
  },
  vacio: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colores.borde,
  },
  conError: { borderColor: Colores.peligro },
  botones: { flexDirection: 'row', gap: Espacio.s },
  boton: { flex: 1 },
  error: { color: Colores.peligro },
});

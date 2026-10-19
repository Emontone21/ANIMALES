import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { estaActivo } from '@/components/ui/interaccion';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
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
  const { c } = useTema();
  const estilos = useEstilos(crear);
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
      <Texto variante="etiquetaCampo">{t.publicar.foto}</Texto>
      {foto ? (
        <Image
          source={{ uri: foto.uri }}
          style={estilos.vistaPrevia}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        // El recuadro grande también abre la cámara (en web, el selector de archivos).
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.publicar.sacarFoto}
          onPress={() => void sacarFoto()}
          style={(estado) => [
            estilos.vistaPrevia,
            estilos.vacio,
            estaActivo(estado) && estilos.vacioActivo,
            error ? estilos.conError : null,
          ]}>
          <Ionicons name="camera-outline" size={40} color={c.textoSecundario} />
          <Texto variante="secundario">{t.publicar.sacarFoto}</Texto>
        </Pressable>
      )}
      <View style={estilos.botones}>
        <Boton
          titulo={foto ? t.publicar.cambiarFoto : t.publicar.sacarFoto}
          icono="camera-outline"
          variante="secundario"
          onPress={() => void sacarFoto()}
          style={estilos.boton}
        />
        <Boton
          titulo={t.publicar.elegirGaleria}
          icono="images-outline"
          variante="secundario"
          onPress={() => void elegirDeGaleria()}
          style={estilos.boton}
        />
      </View>
      {aviso ? <Mensaje texto={aviso} tipo="info" /> : null}
      {error ? (
        <Texto variante="pequeno" color="peligro" accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  contenedor: { gap: Espacio.s },
  vistaPrevia: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radio.xl,
    backgroundColor: c.superficieSuave,
  },
  vacio: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.s,
    borderWidth: 1,
    borderColor: c.superficieSuave,
  },
  vacioActivo: { borderColor: c.borde },
  conError: { borderColor: c.peligro },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  boton: { flex: 1, minWidth: 200 },
}));

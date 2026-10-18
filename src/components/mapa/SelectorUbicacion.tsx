import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapaSelector } from '@/components/mapa/MapaSelector';
import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import { MONTEVIDEO, ZOOM_PUNTO } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

type Props = {
  visible: boolean;
  inicial?: LngLat | null;
  onConfirmar: (punto: LngLat) => void;
  onCancelar: () => void;
};

/**
 * Modal con un mapa y un pin fijo en el centro: el usuario arrastra el mapa
 * hasta que el pin queda sobre el punto exacto.
 */
export function SelectorUbicacion({ visible, inicial, onConfirmar, onCancelar }: Props) {
  const centroInicial = inicial ?? MONTEVIDEO;
  const [centro, setCentro] = useState<LngLat>(centroInicial);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <SafeAreaView style={estilos.raiz} edges={['top', 'bottom']}>
        <View style={estilos.encabezado}>
          <Texto variante="subtitulo">{t.publicar.selectorMapa.titulo}</Texto>
        </View>
        <View style={estilos.mapa}>
          {visible ? (
            <MapaSelector
              centroInicial={centroInicial}
              zoomInicial={inicial ? ZOOM_PUNTO : ZOOM_PUNTO - 2}
              onCentroCambia={setCentro}
            />
          ) : null}
          <View style={estilos.pin} pointerEvents="none">
            <Ionicons name="location" size={44} color={Colores.peligro} />
          </View>
        </View>
        <View style={estilos.pie}>
          <Boton
            titulo={t.comunes.cancelar}
            variante="secundario"
            onPress={onCancelar}
            style={estilos.boton}
          />
          <Boton
            titulo={t.publicar.selectorMapa.confirmar}
            icono="checkmark"
            onPress={() => onConfirmar(centro)}
            style={estilos.boton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colores.fondo },
  encabezado: { padding: Espacio.m },
  mapa: { flex: 1 },
  pin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // El punto del ícono está en la base, así que se corre medio ancho y toda la altura.
    marginLeft: -22,
    marginTop: -44,
  },
  pie: { flexDirection: 'row', gap: Espacio.s, padding: Espacio.m },
  boton: { flex: 1 },
});

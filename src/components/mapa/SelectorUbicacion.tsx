import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapaSelector } from '@/components/mapa/MapaSelector';
import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Margen } from '@/constants/tema';
import { useCerrarConAtras } from '@/hooks/useCerrarConAtras';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { MONTEVIDEO, ZOOM_PUNTO } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

type Props = {
  visible: boolean;
  inicial?: LngLat | null;
  onConfirmar: (punto: LngLat) => void;
  onCancelar: () => void;
};

const PIN = 44;

/**
 * Modal con un mapa y un pin fijo en el centro: la persona mueve el mapa
 * hasta que el pin queda sobre el punto exacto.
 */
export function SelectorUbicacion({ visible, inicial, onConfirmar, onCancelar }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const centroInicial = inicial ?? MONTEVIDEO;
  const [centro, setCentro] = useState<LngLat>(centroInicial);
  useCerrarConAtras(visible, onCancelar);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <SafeAreaView style={estilos.raiz} edges={['top', 'bottom']}>
        <View style={estilos.encabezado}>
          <Texto variante="subtitulo" accessibilityRole="header">
            {t.publicar.selectorMapa.titulo}
          </Texto>
        </View>
        <View style={estilos.mapa}>
          {visible ? (
            <MapaSelector
              centroInicial={centroInicial}
              zoomInicial={inicial ? ZOOM_PUNTO : ZOOM_PUNTO - 2}
              onCentroCambia={setCentro}
            />
          ) : null}
          <View style={estilos.pin}>
            <Ionicons name="location" size={PIN} color={c.primario} />
          </View>
        </View>
        <View style={estilos.pie}>
          <View style={estilos.botones}>
            <Boton
              titulo={t.comunes.cancelar}
              variante="secundario"
              onPress={onCancelar}
              style={estilos.boton}
            />
            <Boton
              titulo={t.publicar.selectorMapa.confirmar}
              icono="checkmark-outline"
              onPress={() => onConfirmar(centro)}
              style={estilos.botonPrincipal}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.superficie },
  encabezado: { paddingHorizontal: Margen.pantalla, paddingVertical: Espacio.m },
  mapa: { flex: 1 },
  pin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // La punta del ícono está en la base: se corre medio ancho y toda la altura.
    marginLeft: -PIN / 2,
    marginTop: -PIN,
    pointerEvents: 'none',
  },
  pie: {
    paddingHorizontal: Margen.pantalla,
    paddingVertical: Espacio.sm,
    borderTopWidth: 1,
    borderTopColor: c.borde,
  },
  botones: {
    flexDirection: 'row',
    gap: Espacio.sm,
    width: '100%',
    maxWidth: AnchoMaximo.formulario,
    alignSelf: 'center',
  },
  boton: { flex: 1 },
  botonPrincipal: { flex: 1.4 },
}));

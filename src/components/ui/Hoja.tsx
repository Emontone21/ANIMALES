import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

export type HojaProps = {
  visible: boolean;
  titulo: string;
  intro?: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Botones al pie (normalmente un Boton de enviar). */
  pie?: ReactNode;
};

/** Modal a pantalla completa con encabezado, contenido con scroll y pie fijo. */
export function Hoja({ visible, titulo, intro, onCerrar, children, pie }: HojaProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={estilos.raiz} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={estilos.raiz}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={estilos.encabezado}>
            <Texto variante="subtitulo" style={estilos.titulo}>
              {titulo}
            </Texto>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.comunes.cancelar}
              onPress={onCerrar}
              hitSlop={12}>
              <Ionicons name="close" size={24} color={Colores.textoSecundario} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            {intro ? <Texto variante="secundario">{intro}</Texto> : null}
            {children}
          </ScrollView>
          {pie ? <View style={estilos.pie}>{pie}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colores.fondo },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.m,
    padding: Espacio.m,
    borderBottomWidth: 1,
    borderBottomColor: Colores.borde,
  },
  titulo: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m, paddingBottom: Espacio.xl },
  pie: {
    padding: Espacio.m,
    borderTopWidth: 1,
    borderTopColor: Colores.borde,
    backgroundColor: Colores.fondo,
    borderTopLeftRadius: Radio.m,
    borderTopRightRadius: Radio.m,
  },
});

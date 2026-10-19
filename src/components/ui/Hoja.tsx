import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Margen, Medida, Radio, sombraFlotante } from '@/constants/tema';
import { useDisposicion } from '@/hooks/useDisposicion';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
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

/**
 * Formulario modal. En celular ocupa la pantalla; en pantallas anchas es una
 * tarjeta centrada de 560 de ancho sobre un velo.
 */
export function Hoja({ visible, titulo, intro, onCerrar, children, pie }: HojaProps) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const compacto = useDisposicion() === 'compacto';

  const contenido = (
    <KeyboardAvoidingView
      style={compacto ? estilos.flex : estilos.flexAncho}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.encabezado}>
        <Texto variante="subtitulo" style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Texto>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.comunes.cerrar}
          onPress={onCerrar}
          style={(estado) => [estilos.cerrar, estaActivo(estado) && estilos.cerrarActivo]}>
          <Ionicons name="close-outline" size={22} color={c.texto} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {intro ? <Texto variante="secundario">{intro}</Texto> : null}
        {children}
      </ScrollView>
      {pie ? <View style={estilos.pie}>{pie}</View> : null}
    </KeyboardAvoidingView>
  );

  if (compacto) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
        <SafeAreaView style={estilos.raiz} edges={['top', 'bottom']}>
          {contenido}
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCerrar}>
      <View style={estilos.velo}>
        <Pressable
          style={estilos.veloToque}
          onPress={onCerrar}
          accessibilityLabel={t.comunes.cerrar}
          accessible={false}
        />
        <SafeAreaView style={estilos.tarjeta} edges={['bottom']}>
          {contenido}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const crear = crearEstilos((c, esquema) => ({
  raiz: { flex: 1, backgroundColor: c.superficie },
  flex: { flex: 1 },
  flexAncho: { flexShrink: 1 },
  velo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espacio.l,
    backgroundColor: c.velo,
  },
  veloToque: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  tarjeta: {
    width: '100%',
    maxWidth: AnchoMaximo.formulario,
    maxHeight: '90%',
    borderRadius: Radio.xl,
    overflow: 'hidden',
    backgroundColor: c.superficie,
    ...sombraFlotante(c, esquema),
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.m,
    paddingLeft: Margen.pantalla,
    paddingRight: Espacio.sm,
    paddingVertical: Espacio.s,
    borderBottomWidth: 1,
    borderBottomColor: c.borde,
  },
  titulo: { flex: 1 },
  cerrar: {
    width: Medida.areaTactil,
    height: Medida.areaTactil,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
  },
  cerrarActivo: { backgroundColor: c.superficieSuave },
  contenido: { padding: Margen.pantalla, gap: Espacio.m, paddingBottom: Espacio.xl },
  pie: {
    paddingHorizontal: Margen.pantalla,
    paddingVertical: Espacio.sm,
    borderTopWidth: 1,
    borderTopColor: c.borde,
    backgroundColor: c.superficie,
  },
}));

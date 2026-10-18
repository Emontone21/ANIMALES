import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

type Props = {
  texto: string;
  tipo?: 'error' | 'info' | 'exito';
  onReintentar?: () => void;
};

/** Aviso en línea: errores de red, confirmaciones, pistas. */
export function Mensaje({ texto, tipo = 'info', onReintentar }: Props) {
  const esError = tipo === 'error';
  const color = esError ? Colores.peligro : tipo === 'exito' ? Colores.exito : Colores.primario;
  const fondo = esError ? Colores.peligroSuave : Colores.primarioSuave;
  const icono = esError
    ? 'alert-circle'
    : tipo === 'exito'
      ? 'checkmark-circle'
      : 'information-circle';

  return (
    <View style={[estilos.caja, { backgroundColor: fondo }]} accessibilityRole="alert">
      <Ionicons name={icono} size={20} color={color} />
      <Texto style={[estilos.texto, { color }]}>{texto}</Texto>
      {onReintentar ? (
        <Boton titulo={t.comunes.reintentar} variante="fantasma" onPress={onReintentar} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.s,
    padding: Espacio.m,
    borderRadius: Radio.m,
  },
  texto: { flex: 1, fontSize: 14 },
});

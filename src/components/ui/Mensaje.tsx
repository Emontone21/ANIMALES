import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Medida, type Paleta, Radio, Tipografia } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

type Tipo = 'error' | 'info' | 'exito';

type Props = {
  texto: string;
  tipo?: Tipo;
  onReintentar?: () => void;
};

const COLORES: Record<Tipo, { fondo: keyof Paleta; texto: keyof Paleta }> = {
  info: { fondo: 'superficieSuave', texto: 'texto' },
  error: { fondo: 'peligroSuave', texto: 'peligro' },
  exito: { fondo: 'primarioSuave', texto: 'textoPrimarioSuave' },
};

const ICONO = {
  info: 'information-circle-outline',
  error: 'alert-circle-outline',
  exito: 'checkmark-circle-outline',
} as const;

/** Aviso en línea: errores de red, confirmaciones, pistas (6.16). */
export function Mensaje({ texto, tipo = 'info', onReintentar }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const colores = COLORES[tipo];

  return (
    <View
      style={[estilos.caja, { backgroundColor: c[colores.fondo] }]}
      accessibilityRole={tipo === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite">
      <Ionicons name={ICONO[tipo]} size={20} color={c[colores.texto]} />
      <Texto variante="secundario" color={colores.texto} style={estilos.texto}>
        {texto}
      </Texto>
      {onReintentar ? (
        <Boton
          titulo={t.comunes.reintentar}
          variante="fantasma"
          onPress={onReintentar}
          style={estilos.reintentar}
        />
      ) : null}
    </View>
  );
}

const crear = crearEstilos(() => ({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.sm,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.m - 2,
    borderRadius: Radio.l,
  },
  texto: { flex: 1, ...Tipografia.secundario },
  reintentar: { minHeight: Medida.areaTactil, paddingHorizontal: Espacio.sm },
}));

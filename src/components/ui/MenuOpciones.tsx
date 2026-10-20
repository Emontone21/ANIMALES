import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, type BotonProps } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Margen, Radio, sombraFlotante } from '@/constants/tema';
import { useCerrarConAtras } from '@/hooks/useCerrarConAtras';
import { useDisposicion } from '@/hooks/useDisposicion';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

export type OpcionMenu = Pick<
  BotonProps,
  'titulo' | 'icono' | 'variante' | 'cargando' | 'deshabilitado' | 'onPress'
>;

type Props = {
  visible: boolean;
  titulo: string;
  descripcion?: string;
  /** Algo más entre la descripción y las opciones (por ejemplo, un link para copiar). */
  contenido?: ReactNode;
  opciones: OpcionMenu[];
  error?: string | null;
  onCerrar: () => void;
};

/**
 * Lista corta de acciones. En celular sube desde abajo; en pantallas anchas es
 * una tarjeta centrada. Siempre termina con Cancelar.
 */
export function MenuOpciones({
  visible,
  titulo,
  descripcion,
  contenido,
  opciones,
  error,
  onCerrar,
}: Props) {
  const estilos = useEstilos(crear);
  const insets = useSafeAreaInsets();
  const compacto = useDisposicion() === 'compacto';
  useCerrarConAtras(visible, onCerrar);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={compacto ? 'slide' : 'fade'}
      onRequestClose={onCerrar}>
      <View style={[estilos.velo, compacto ? estilos.veloAbajo : estilos.veloCentro]}>
        <Pressable style={estilos.veloToque} onPress={onCerrar} accessible={false} />
        <View
          accessibilityViewIsModal
          style={[
            estilos.tarjeta,
            compacto
              ? [estilos.tarjetaAbajo, { paddingBottom: insets.bottom + Espacio.m }]
              : estilos.tarjetaCentro,
          ]}>
          {compacto ? <View style={estilos.manija} /> : null}
          <Texto variante="subtitulo" accessibilityRole="header">
            {titulo}
          </Texto>
          {descripcion ? <Texto variante="secundario">{descripcion}</Texto> : null}
          {contenido}
          {error ? <Mensaje texto={error} tipo="error" /> : null}
          <View style={estilos.opciones}>
            {opciones.map((opcion) => (
              <Boton key={opcion.titulo} variante="secundario" {...opcion} />
            ))}
            <Boton titulo={t.comunes.cancelar} variante="fantasma" onPress={onCerrar} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const crear = crearEstilos((c, esquema) => ({
  velo: { flex: 1, backgroundColor: c.velo },
  veloAbajo: { justifyContent: 'flex-end' },
  veloCentro: { alignItems: 'center', justifyContent: 'center', padding: Espacio.l },
  veloToque: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  tarjeta: {
    gap: Espacio.sm,
    paddingHorizontal: Margen.pantalla,
    backgroundColor: c.superficie,
    ...sombraFlotante(c, esquema),
  },
  tarjetaAbajo: {
    paddingTop: Espacio.s,
    borderTopLeftRadius: Radio.hoja,
    borderTopRightRadius: Radio.hoja,
  },
  tarjetaCentro: {
    width: '100%',
    maxWidth: AnchoMaximo.acceso,
    paddingVertical: Margen.pantalla,
    borderRadius: Radio.xl,
  },
  manija: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    marginBottom: Espacio.s,
    borderRadius: Radio.redondo,
    backgroundColor: c.borde,
  },
  opciones: { gap: Espacio.s, marginTop: Espacio.xs },
}));

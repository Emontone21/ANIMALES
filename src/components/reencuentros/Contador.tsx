import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { numeroVisible, useContadorReencuentros } from '@/features/reencuentros/contador';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/**
 * El contador de reencuentros, en su propio bloque: lo cargan con lazy la
 * tarjeta de "Cerca tuyo" (cuando el mapa ya mostró sus casos) y el muro. Si
 * los dos importaran la consulta, Metro la pondría en __common, y si la
 * tarjeta fuera en el bloque del mapa, sumaría a la carga de / (docs/
 * ARQUITECTURA.md, "Carga inicial en web").
 */

export type EstadoContador =
  | { estado: 'cargando' }
  | { estado: 'error' }
  /** `numero`: null mientras haya menos de 5 (se dice "Los primeros reencuentros de Spot"). */
  | { estado: 'listo'; total: number; numero: number | null };

/** Para el muro, que lo dibuja a su manera (y muestra su lugar mientras carga). */
export function ConContador({ children }: { children: (contador: EstadoContador) => ReactNode }) {
  const contador = useContadorReencuentros();
  if (contador.isPending) return children({ estado: 'cargando' });
  if (contador.isError) return children({ estado: 'error' });
  return children({
    estado: 'listo',
    total: contador.data,
    numero: numeroVisible(contador.data),
  });
}

export type PropsTarjeta = {
  /** En el carrusel de "Cerca tuyo" (celular) o como fila del panel (tablet y computadora). */
  forma: 'carrusel' | 'fila';
  /** En el carrusel, el ancho y el alto de la foto de las tarjetas de al lado, para que quede pareja. */
  ancho?: number;
  altoFoto?: number;
};

/**
 * "34 volvieron a casa · Ver historias" (docs/DISENO.md, 6.7): la entrada al
 * muro desde el mapa, al final de los casos. Sin número mientras haya menos de
 * 5: "Los primeros reencuentros de Spot". Mientras carga o si el contador no
 * carga, no aparece.
 */
export function TarjetaReencuentros({ forma, ancho, altoFoto = 0 }: PropsTarjeta) {
  const router = useRouter();
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const contador = useContadorReencuentros();
  if (!contador.isSuccess) return null;
  const texto = t.reencuentros.tarjeta(numeroVisible(contador.data));

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${texto}. ${t.reencuentros.verHistorias}`}
      onPress={() => router.push('/reencuentros')}
      style={(estado) => [
        forma === 'fila'
          ? estilos.fila
          : [estilos.carrusel, { width: ancho, minHeight: altoFoto + Espacio.xxl }],
        estaActivo(estado) && estilos.activa,
      ]}>
      <View style={estilos.icono}>
        <Ionicons name="heart-outline" size={22} color={c.textoPrimarioSuave} />
      </View>
      <View style={estilos.textos}>
        <Texto variante="tituloTarjeta" color="textoPrimarioSuave">
          {texto}
        </Texto>
        <Texto variante="etiquetaCampo" color="primario">
          {t.reencuentros.verHistorias}
        </Texto>
      </View>
    </Pressable>
  );
}

const crear = crearEstilos((c) => ({
  carrusel: {
    justifyContent: 'flex-end',
    gap: Espacio.sm,
    padding: Espacio.m,
    borderRadius: Radio.l,
    borderWidth: 1.5,
    borderColor: c.primarioSuave,
    backgroundColor: c.primarioSuave,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.sm,
    padding: Espacio.sm,
    borderRadius: Radio.l,
    borderWidth: 1.5,
    borderColor: c.primarioSuave,
    backgroundColor: c.primarioSuave,
  },
  // Presionada o con hover: el borde en primario.
  activa: { borderColor: c.primario },
  icono: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: c.superficie,
  },
  textos: { flex: 1, gap: Espacio.xs },
}));

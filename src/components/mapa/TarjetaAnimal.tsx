import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { EtiquetaEspecie, EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';
import type { AnimalEnMapa } from '@/types/dominio';

type Props = { animal: AnimalEnMapa; onVerDetalle: () => void; onCerrar: () => void };

/** Resumen flotante que aparece al tocar un marcador del mapa. */
export function TarjetaAnimal({ animal, onVerDetalle, onCerrar }: Props) {
  return (
    <View style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <Image
        source={{ uri: urlFoto(animal.foto_principal_path) }}
        style={estilos.foto}
        contentFit="cover"
        transition={150}
      />
      <View style={estilos.cuerpo}>
        <View style={estilos.etiquetas}>
          <EtiquetaEspecie especie={animal.especie} />
          <EtiquetaEstado estado={animal.estado} />
        </View>
        <Texto numberOfLines={2}>{animal.descripcion ?? t.animal.sinDescripcion}</Texto>
        <Texto variante="pequeno">
          {haceCuanto(animal.ultimo_visto_en)} ·{' '}
          {t.animal.avistamientos(animal.cantidad_avistamientos)}
        </Texto>
        <Boton titulo={t.mapa.verDetalle} onPress={onVerDetalle} icono="arrow-forward" />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.comunes.cancelar}
        onPress={onCerrar}
        hitSlop={12}
        style={estilos.cerrar}>
        <Ionicons name="close" size={20} color={Colores.textoSecundario} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    position: 'absolute',
    left: Espacio.m,
    right: Espacio.m,
    bottom: Espacio.l,
    flexDirection: 'row',
    gap: Espacio.m,
    padding: Espacio.m,
    borderRadius: Radio.l,
    backgroundColor: Colores.fondo,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  foto: { width: 96, height: 128, borderRadius: Radio.m, backgroundColor: Colores.fondoSuave },
  cuerpo: { flex: 1, gap: Espacio.s },
  etiquetas: { flexDirection: 'row', gap: Espacio.s, flexWrap: 'wrap' },
  cerrar: { position: 'absolute', top: Espacio.s, right: Espacio.s },
});

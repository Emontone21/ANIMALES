import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, type Paleta, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { TipoReporte } from '@/types/dominio';

const OPCIONES: {
  tipo: TipoReporte;
  icono: ComponentProps<typeof Ionicons>['name'];
  fondo: keyof Paleta;
  color: keyof Paleta;
}[] = [
  { tipo: 'perdido', icono: 'search-outline', fondo: 'perdidoSuave', color: 'textoPerdido' },
  { tipo: 'encontrado', icono: 'paw-outline', fondo: 'primarioSuave', color: 'textoPrimarioSuave' },
];

/** Primer paso de Publicar: "Perdí a mi animal" o "Encontré un animal" (7.3). */
export function ElegirTipoReporte({ onElegir }: { onElegir: (tipo: TipoReporte) => void }) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.lista}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {t.publicar.elegirTipo}
      </Texto>
      {OPCIONES.map((opcion) => (
        <Pressable
          key={opcion.tipo}
          accessibilityRole="button"
          accessibilityLabel={`${t.publicar.tipos[opcion.tipo].titulo}. ${t.publicar.tipos[opcion.tipo].detalle}`}
          onPress={() => onElegir(opcion.tipo)}
          style={(estado) => [estilos.opcion, estaActivo(estado) && estilos.opcionActiva]}>
          <View style={[estilos.icono, { backgroundColor: c[opcion.fondo] }]}>
            <Ionicons name={opcion.icono} size={22} color={c[opcion.color]} />
          </View>
          <View style={estilos.textos}>
            <Texto variante="tituloTarjeta">{t.publicar.tipos[opcion.tipo].titulo}</Texto>
            <Texto variante="secundario">{t.publicar.tipos[opcion.tipo].detalle}</Texto>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textoSecundario} />
        </Pressable>
      ))}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  lista: { gap: Espacio.sm },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.m,
    padding: Espacio.ml,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  opcionActiva: { backgroundColor: c.superficieSuave },
  icono: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
  },
  textos: { flex: 1, gap: Espacio.xs },
}));

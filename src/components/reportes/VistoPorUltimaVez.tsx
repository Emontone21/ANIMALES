import { View } from 'react-native';

import { MapaRecorrido } from '@/components/mapa/MapaRecorrido';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio, type TipoReporte } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { diaYHora } from '@/lib/fechas';
import type { AvistamientoDetalle, EstadoAnimal } from '@/types/dominio';

type Props = {
  /** Más nuevo primero, como los devuelve la API. */
  avistamientos: AvistamientoDetalle[];
  estado: EstadoAnimal;
  tipo?: TipoReporte;
};

/** Mini mapa con el recorrido y el último avistamiento (6.9). */
export function VistoPorUltimaVez({ avistamientos, estado, tipo }: Props) {
  const estilos = useEstilos(crear);
  const ultimo = avistamientos[0];
  if (!ultimo) return null;

  return (
    <View style={estilos.tarjeta}>
      <MapaRecorrido
        // Si cambian los avistamientos se vuelve a crear con los nuevos límites.
        key={avistamientos.map((av) => av.id).join(',')}
        avistamientos={avistamientos}
        estado={estado}
        tipo={tipo}
      />
      <View style={estilos.textos}>
        <Texto variante="secundario">{t.animal.ultimaVez}</Texto>
        <Texto variante="cuerpoFuerte">{diaYHora(ultimo.visto_en)}</Texto>
        {ultimo.nota ? <Texto color="textoCuerpo">{ultimo.nota}</Texto> : null}
      </View>
    </View>
  );
}

const crear = crearEstilos((c) => ({
  tarjeta: {
    gap: Espacio.sm,
    padding: 14,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  textos: { gap: 2, paddingHorizontal: Espacio.xs },
}));

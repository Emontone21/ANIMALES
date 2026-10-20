import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { MapaRecorrido } from '@/components/mapa/MapaRecorrido';
import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio, sombraFlotante, type TipoReporte } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { diaYHora } from '@/lib/fechas';
import type { AvistamientoDetalle, EstadoAnimal } from '@/types/dominio';

/** Diámetro del botón de agrandar sobre el mini mapa (se toca todo el mapa). */
const DIAMETRO_AGRANDAR = 36;

type Props = {
  /** Más nuevo primero, como los devuelve la API. */
  avistamientos: AvistamientoDetalle[];
  estado: EstadoAnimal;
  tipo?: TipoReporte;
  /** Abre el mapa en grande del recorrido (6.9.1). */
  onVerEnGrande: () => void;
};

/** Mini mapa con el recorrido y el último avistamiento (6.9). Tocarlo lo abre en grande. */
export function VistoPorUltimaVez({ avistamientos, estado, tipo, onVerEnGrande }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const ultimo = avistamientos[0];
  if (!ultimo) return null;

  return (
    <View style={estilos.tarjeta}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.mapa.recorrido.verEnGrande}
        onPress={onVerEnGrande}
        style={estilos.mapa}>
        {(interaccion) => (
          <>
            {/* El nombre del botón ya lo dice: el mapa de adentro no se anuncia ni
                recibe toques (en nativo, el mapa se quedaría con el toque). */}
            <View aria-hidden style={estilos.sinToques}>
              <MapaRecorrido
                // Si cambian los avistamientos se vuelve a crear con los nuevos límites.
                key={avistamientos.map((av) => av.id).join(',')}
                avistamientos={avistamientos}
                estado={estado}
                tipo={tipo}
              />
            </View>
            <View style={[estilos.agrandar, estaActivo(interaccion) && estilos.agrandarActivo]}>
              <Ionicons name="expand-outline" size={20} color={c.texto} />
            </View>
          </>
        )}
      </Pressable>
      <View style={estilos.textos}>
        <Texto variante="secundario">{t.animal.ultimaVez}</Texto>
        <Texto variante="cuerpoFuerte">{diaYHora(ultimo.visto_en)}</Texto>
        {ultimo.nota ? <Texto color="textoCuerpo">{ultimo.nota}</Texto> : null}
      </View>
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  tarjeta: {
    gap: Espacio.sm,
    padding: 14,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  // El radio del mini mapa: el anillo de foco lo sigue.
  mapa: { borderRadius: Radio.m },
  sinToques: { pointerEvents: 'none' },
  agrandar: {
    position: 'absolute',
    right: Espacio.s,
    bottom: Espacio.s,
    width: DIAMETRO_AGRANDAR,
    height: DIAMETRO_AGRANDAR,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: c.superficie,
    pointerEvents: 'none',
    ...sombraFlotante(c, esquema),
  },
  agrandarActivo: { backgroundColor: c.superficieSuave },
  textos: { gap: 2, paddingHorizontal: Espacio.xs },
}));

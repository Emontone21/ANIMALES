import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { MapaRecorrido } from '@/components/mapa/MapaRecorrido';
import { SelectorUbicacion } from '@/components/mapa/SelectorUbicacion';
import { puntoComoRecorrido } from '@/components/mapa/tipos';
import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { obtenerPosicionActual } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

type Props = {
  valor: LngLat | null;
  onCambio: (punto: LngLat) => void;
  error?: string | null;
};

/** Botones "Usar mi ubicación" / "Elegir en el mapa" con el estado del punto elegido. */
export function CampoUbicacion({ valor, onCambio, error }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const [eligiendoEnMapa, setEligiendoEnMapa] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [avisoGps, setAvisoGps] = useState<string | null>(null);

  const usarGps = async () => {
    setBuscandoGps(true);
    setAvisoGps(null);
    const posicion = await obtenerPosicionActual();
    setBuscandoGps(false);
    if (posicion) {
      onCambio(posicion);
    } else {
      setAvisoGps(t.publicar.permisoUbicacion);
    }
  };

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaBotones}>
        <Boton
          titulo={t.publicar.usarGps}
          icono="locate-outline"
          variante="secundario"
          cargando={buscandoGps}
          onPress={() => void usarGps()}
          style={estilos.botonMitad}
        />
        <Boton
          titulo={t.publicar.elegirMapa}
          icono="map-outline"
          variante="secundario"
          onPress={() => setEligiendoEnMapa(true)}
          style={estilos.botonMitad}
        />
      </View>
      {valor ? (
        <>
          {/* Mini mapa con el punto elegido; se vuelve a crear si cambia. */}
          <MapaRecorrido
            key={valor.join(',')}
            avistamientos={puntoComoRecorrido(valor)}
            estado="avistado"
          />
          <View style={estilos.ubicacionOk}>
            <Ionicons name="checkmark-circle-outline" size={18} color={c.exito} />
            <Texto variante="secundario">
              {t.publicar.ubicacionMarcada} · {valor[1].toFixed(5)}, {valor[0].toFixed(5)}
            </Texto>
          </View>
        </>
      ) : null}
      {error ? (
        <Texto variante="pequeno" color="peligro" accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
      {avisoGps ? <Mensaje texto={avisoGps} /> : null}

      <SelectorUbicacion
        visible={eligiendoEnMapa}
        inicial={valor}
        onConfirmar={(punto) => {
          onCambio(punto);
          setEligiendoEnMapa(false);
        }}
        onCancelar={() => setEligiendoEnMapa(false)}
      />
    </View>
  );
}

const crear = crearEstilos(() => ({
  contenedor: { gap: Espacio.s },
  filaBotones: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  botonMitad: { flex: 1, minWidth: 200 },
  ubicacionOk: { flexDirection: 'row', alignItems: 'center', gap: Espacio.xs, flexWrap: 'wrap' },
}));

import { View } from 'react-native';

import { MARCADOR } from '@/components/mapa/estilosCapa';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { coloresDeEstado, sombraFlotante } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { AnimalEnMapa } from '@/types/dominio';

/**
 * Solo nativo: marcador de un animal con su miniatura (docs/DISENO.md, 6.6).
 * Círculo de 48 (58 si está seleccionado) con borde interno en superficie,
 * anillo del color del tipo, colita en rombo y, en los perdidos, halo. Los
 * reunidos van al 45 %. No recibe toques: los recibe la zona táctil de abajo.
 * En web se arma como elemento del DOM (MapaReportesGL).
 */
export function MarcadorFoto({
  animal,
  seleccionado = false,
}: {
  animal: AnimalEnMapa;
  seleccionado?: boolean;
}) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const { anillo, opacidad } = coloresDeEstado(c, animal.estado, animal.tipo_reporte);
  const diametro = seleccionado ? MARCADOR.diametroSeleccionado : MARCADOR.diametro;
  const perdido = animal.tipo_reporte === 'perdido';
  const lado = diametro + 2 * MARCADOR.halo;

  return (
    <View
      // Lugar para el halo arriba y a los costados, para que el marcador no lo recorte.
      style={[
        estilos.raiz,
        { opacity: opacidad },
        perdido && { paddingTop: MARCADOR.halo, paddingHorizontal: MARCADOR.halo },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={{ width: diametro, height: diametro }}>
        {perdido ? (
          <View
            style={[
              estilos.halo,
              {
                width: lado,
                height: lado,
                borderRadius: lado / 2,
                top: -MARCADOR.halo,
                left: -MARCADOR.halo,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            estilos.circulo,
            { width: diametro, height: diametro, borderRadius: diametro / 2, borderColor: anillo },
          ]}>
          <FotoMiniatura
            ruta={animal.foto_principal_path}
            descripcion={t.animal.tituloCaso(
              animal.nombre,
              animal.especie,
              animal.color,
              animal.tamanio,
            )}
            style={[estilos.foto, { borderRadius: diametro / 2 }]}
            contentFit="cover"
          />
        </View>
      </View>
      <View style={[estilos.colita, { backgroundColor: anillo }]} />
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  raiz: { alignItems: 'center' },
  halo: { position: 'absolute', backgroundColor: c.perdido, opacity: MARCADOR.opacidadHalo },
  circulo: {
    // Primero la sombra: su borde de 1 px (en oscuro) lo reemplaza el anillo de 3.
    ...sombraFlotante(c, esquema),
    padding: MARCADOR.borde,
    borderWidth: MARCADOR.anillo,
    backgroundColor: c.superficie,
  },
  foto: { flex: 1, backgroundColor: c.superficieSuave },
  colita: {
    width: MARCADOR.colita,
    height: MARCADOR.colita,
    marginTop: -MARCADOR.solapeColita,
    transform: [{ rotate: '45deg' }],
  },
}));

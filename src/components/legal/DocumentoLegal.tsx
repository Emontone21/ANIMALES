import { View } from 'react-native';

import { Etiqueta } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { VERSION_TERMINOS } from '@/features/legal/terminos';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { fechaLarga } from '@/lib/fechas';

type Documento = {
  titulo: string;
  intro: string;
  secciones: readonly { titulo: string; parrafos: readonly string[] }[];
};

/**
 * Términos de uso o política de privacidad: se leen sin cuenta. Hoy son un
 * borrador. El título va en el encabezado de la pantalla.
 */
export function DocumentoLegal({ documento }: { documento: Documento }) {
  const estilos = useEstilos(crear);
  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.lista}>
      <View style={estilos.cabecera}>
        <Etiqueta texto={t.legal.borrador} fondo="superficieSuave" color="texto" />
        <Texto variante="secundario">{t.legal.version(fechaLarga(VERSION_TERMINOS))}</Texto>
      </View>
      <Mensaje texto={t.legal.borradorAviso} />
      <Texto color="textoCuerpo">{documento.intro}</Texto>
      {documento.secciones.map((seccion) => (
        <View key={seccion.titulo} style={estilos.seccion}>
          <Texto variante="subtitulo" accessibilityRole="header">
            {seccion.titulo}
          </Texto>
          {seccion.parrafos.map((parrafo) => (
            <Texto key={parrafo} color="textoCuerpo">
              {parrafo}
            </Texto>
          ))}
        </View>
      ))}
    </Pantalla>
  );
}

const crear = crearEstilos(() => ({
  cabecera: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Espacio.sm },
  seccion: { gap: Espacio.s, marginTop: Espacio.s },
}));

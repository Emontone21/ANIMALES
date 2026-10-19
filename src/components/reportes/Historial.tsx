import { Image } from 'expo-image';

import { type EventoLinea, LineaTiempo } from '@/components/ui/LineaTiempo';
import { Texto } from '@/components/ui/Texto';
import { coloresDeEstado, Fuentes, Radio, type TipoReporte } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { fechaHoraCorta } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';
import type { EstadoAnimal, EventoHistorial } from '@/types/dominio';

type Props = {
  eventos: EventoHistorial[];
  /** Estado y tipo del caso: dan el color del evento más reciente. */
  estado: EstadoAnimal;
  tipo?: TipoReporte;
};

/** Historial del detalle (6.11): avistamientos y cambios de estado, más nuevo primero. */
export function Historial({ eventos, estado, tipo }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const colores = coloresDeEstado(c, estado, tipo);

  const lineas = eventos.map((evento): EventoLinea => {
    if (evento.tipo === 'avistamiento') {
      const av = evento.avistamiento;
      return {
        id: `av-${av.id}`,
        titulo: `${t.tipoAvistamiento[av.tipo]} ${av.usuario_nombre}`,
        nota: av.nota,
        fecha: fechaHoraCorta(evento.fecha),
        extra: av.foto_path ? (
          <Image
            source={{ uri: urlFoto(av.foto_path) }}
            style={estilos.miniatura}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null,
      };
    }
    const cambio = evento.cambio;
    return {
      id: `ce-${cambio.id}`,
      titulo: `${t.animal.cambioEstado.titulo(t.estado[cambio.estado_nuevo])} ${t.animal.cambioEstado.por(cambio.usuario_nombre)}`,
      nota: cambio.nota,
      fecha: fechaHoraCorta(evento.fecha),
      detalle: cambio.contacto_compartido ? (
        <Texto variante="secundario" color="primario" style={estilos.contacto}>
          {t.animal.contacto}: {cambio.contacto_compartido}
        </Texto>
      ) : null,
    };
  });

  return (
    <LineaTiempo eventos={lineas} colorActual={colores.anillo} colorActualSuave={colores.fondo} />
  );
}

const crear = crearEstilos((c) => ({
  miniatura: {
    width: 56,
    height: 56,
    borderRadius: Radio.s,
    backgroundColor: c.superficieSuave,
  },
  contacto: Fuentes.seminegrita,
}));

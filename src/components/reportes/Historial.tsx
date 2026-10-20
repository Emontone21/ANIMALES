import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { type EventoLinea, LineaTiempo } from '@/components/ui/LineaTiempo';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import {
  coloresDeEstado,
  Espacio,
  Fuentes,
  Medida,
  Radio,
  type TipoReporte,
} from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { fechaHoraCorta } from '@/lib/fechas';
import type { EstadoAnimal, EventoHistorial } from '@/types/dominio';

/** "Escribirle" a quien lo vio: lo ve quien publicó el caso (permisos.ts, aQuienesLoVieron). */
export type EscribirDesdeHistorial = {
  escribibles: string[];
  escribir: (usuarioId: string) => void;
  /** A quién se le está abriendo la conversación. */
  escribiendoA: string | null;
  error: { usuarioId: string; texto: string } | null;
};

type Props = {
  eventos: EventoHistorial[];
  /** Estado y tipo del caso: dan el color del evento más reciente. */
  estado: EstadoAnimal;
  tipo?: TipoReporte;
  escribir?: EscribirDesdeHistorial;
};

/** Historial del detalle (6.11): avistamientos y cambios de estado, más nuevo primero. */
export function Historial({ eventos, estado, tipo, escribir }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const colores = coloresDeEstado(c, estado, tipo);
  // El error de abrir una conversación va una sola vez, en el aviso más reciente de esa persona.
  const conError = new Set<string>();

  const lineas = eventos.map((evento): EventoLinea => {
    if (evento.tipo === 'avistamiento') {
      const av = evento.avistamiento;
      const otro = av.usuario_id;
      const puedeEscribirle = !!otro && !!escribir?.escribibles.includes(otro);
      const error =
        otro && escribir?.error?.usuarioId === otro && !conError.has(otro)
          ? escribir.error.texto
          : null;
      if (error && otro) conError.add(otro);
      return {
        id: `av-${av.id}`,
        // "Lo vio Carla"; el primer avistamiento de un perdido es "Se perdió acá".
        // Sin nombre: quien lo hizo borró su cuenta y lo dejó publicado.
        titulo:
          av.tipo === 'perdido'
            ? t.tipoAvistamiento.perdido
            : `${t.tipoAvistamiento[av.tipo]} ${av.usuario_nombre ?? t.comunes.cuentaEliminada}`,
        nota: av.nota,
        fecha: fechaHoraCorta(evento.fecha),
        detalle:
          puedeEscribirle && otro && escribir ? (
            <View style={estilos.escribir}>
              <Boton
                titulo={t.mensajes.escribirle}
                accessibilityLabel={t.mensajes.escribirleA(
                  av.usuario_nombre ?? t.comunes.cuentaEliminada,
                )}
                variante="fantasma"
                icono="chatbubble-outline"
                cargando={escribir.escribiendoA === otro}
                deshabilitado={escribir.escribiendoA !== null}
                onPress={() => escribir.escribir(otro)}
                style={estilos.botonEscribir}
              />
              {error ? <Mensaje texto={error} tipo="error" /> : null}
            </View>
          ) : null,
        extra: av.foto_path ? (
          <FotoMiniatura
            ruta={av.foto_path}
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
      titulo: `${t.animal.cambioEstado.titulo(t.estado[cambio.estado_nuevo])} ${t.animal.cambioEstado.por(cambio.usuario_nombre ?? t.comunes.cuentaEliminada)}`,
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
  escribir: { gap: Espacio.xs, alignItems: 'flex-start' },
  // Fantasma de 44 de alto (no 54): va dentro de cada fila del historial.
  botonEscribir: {
    minHeight: Medida.areaTactil,
    paddingHorizontal: Espacio.m,
    marginLeft: -Espacio.m,
  },
}));

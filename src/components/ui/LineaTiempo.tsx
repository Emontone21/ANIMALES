import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Fuentes } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

export type EventoLinea = {
  id: string;
  /** Quién hizo qué: "Lo vio Carla". */
  titulo: string;
  nota?: string | null;
  fecha: string;
  /** Contenido extra al costado (por ejemplo, la foto del avistamiento). */
  extra?: ReactNode;
  /** Datos extra debajo de la nota (por ejemplo, el contacto compartido). */
  detalle?: ReactNode;
};

type Props = {
  eventos: EventoLinea[];
  /** Color del punto del evento más reciente (el del tipo del caso) y su tono suave. */
  colorActual: string;
  colorActualSuave: string;
};

const PUNTO = 18;

/** Línea de tiempo vertical, más nuevo primero (6.11). */
export function LineaTiempo({ eventos, colorActual, colorActualSuave }: Props) {
  const estilos = useEstilos(crear);
  return (
    <View>
      {eventos.map((evento, i) => {
        const primero = i === 0;
        const ultimo = i === eventos.length - 1;
        return (
          <View key={evento.id} style={estilos.fila}>
            <View style={estilos.columnaPunto}>
              <View
                style={[
                  estilos.punto,
                  primero
                    ? {
                        backgroundColor: colorActual,
                        borderColor: colorActualSuave,
                        borderWidth: 4,
                      }
                    : estilos.puntoAnterior,
                ]}
              />
              {!ultimo ? <View style={estilos.linea} /> : null}
            </View>
            <View style={[estilos.cuerpo, !ultimo && estilos.cuerpoConSeparacion]}>
              <View style={estilos.textos}>
                <Texto style={estilos.titulo}>{evento.titulo}</Texto>
                {evento.nota ? <Texto color="textoCuerpo">{evento.nota}</Texto> : null}
                {evento.detalle}
                <Texto variante="pequeno">{evento.fecha}</Texto>
              </View>
              {evento.extra}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  fila: { flexDirection: 'row', gap: Espacio.sm },
  columnaPunto: { width: PUNTO, alignItems: 'center' },
  punto: { width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, marginTop: 2 },
  puntoAnterior: { backgroundColor: c.superficie, borderWidth: 3, borderColor: c.puntoInactivo },
  linea: { flex: 1, width: 2, marginVertical: Espacio.xs, backgroundColor: c.borde },
  cuerpo: { flex: 1, flexDirection: 'row', gap: Espacio.sm },
  cuerpoConSeparacion: { paddingBottom: Espacio.l },
  textos: { flex: 1, gap: Espacio.xs },
  titulo: { ...Fuentes.negrita, fontSize: 15, lineHeight: 20, color: c.texto },
}));

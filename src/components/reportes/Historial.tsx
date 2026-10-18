import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import { fechaHoraCorta } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';
import type { EventoHistorial } from '@/types/dominio';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

const ICONO_AVISTAMIENTO = { encontrado: 'flag', visto: 'eye', resguardado: 'home' } as const;
const ICONO_ESTADO = {
  avistado: 'refresh',
  resguardado: 'home',
  reunido: 'heart',
  vinculado: 'link',
} as const;

/** Línea de tiempo del detalle: avistamientos y cambios de estado, más nuevo primero. */
export function Historial({ eventos }: { eventos: EventoHistorial[] }) {
  return (
    <View style={estilos.lista}>
      {eventos.map((evento) =>
        evento.tipo === 'avistamiento' ? (
          <Fila
            key={`av-${evento.avistamiento.id}`}
            icono={ICONO_AVISTAMIENTO[evento.avistamiento.tipo]}
            titulo={`${t.tipoAvistamiento[evento.avistamiento.tipo]} ${evento.avistamiento.usuario_nombre}`}
            fecha={evento.fecha}
            nota={evento.avistamiento.nota}
            fotoPath={evento.avistamiento.foto_path}
          />
        ) : (
          <Fila
            key={`ce-${evento.cambio.id}`}
            icono={ICONO_ESTADO[evento.cambio.estado_nuevo]}
            titulo={t.animal.cambioEstado.titulo(t.estado[evento.cambio.estado_nuevo])}
            subtitulo={t.animal.cambioEstado.por(evento.cambio.usuario_nombre)}
            fecha={evento.fecha}
            nota={evento.cambio.nota}
            contacto={evento.cambio.contacto_compartido}
          />
        ),
      )}
    </View>
  );
}

type FilaProps = {
  icono: NombreIcono;
  titulo: string;
  subtitulo?: string;
  fecha: string;
  nota?: string | null;
  contacto?: string | null;
  fotoPath?: string | null;
};

function Fila({ icono, titulo, subtitulo, fecha, nota, contacto, fotoPath }: FilaProps) {
  return (
    <View style={estilos.fila}>
      <View style={estilos.filaIcono}>
        <Ionicons name={icono} size={18} color={Colores.primario} />
      </View>
      <View style={estilos.filaCuerpo}>
        <Texto style={estilos.filaTitulo}>{titulo}</Texto>
        <Texto variante="pequeno">
          {subtitulo ? `${subtitulo} · ` : ''}
          {fechaHoraCorta(fecha)}
        </Texto>
        {nota ? <Texto variante="secundario">{nota}</Texto> : null}
        {contacto ? (
          <Texto variante="secundario" style={estilos.contacto}>
            {t.animal.contacto}: {contacto}
          </Texto>
        ) : null}
      </View>
      {fotoPath ? (
        <Image source={{ uri: urlFoto(fotoPath) }} style={estilos.miniatura} contentFit="cover" />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: Espacio.s },
  fila: {
    flexDirection: 'row',
    gap: Espacio.m,
    padding: Espacio.m,
    borderRadius: Radio.m,
    backgroundColor: Colores.fondoSuave,
  },
  filaIcono: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.primarioSuave,
  },
  filaCuerpo: { flex: 1, gap: Espacio.xs },
  filaTitulo: { fontWeight: '600' },
  contacto: { color: Colores.primario, fontWeight: '600' },
  miniatura: { width: 56, height: 56, borderRadius: Radio.s },
});

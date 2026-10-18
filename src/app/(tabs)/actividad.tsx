import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Chips } from '@/components/ui/Chips';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConversaciones } from '@/features/mensajes/api';
import {
  useMarcarLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
} from '@/features/notificaciones/api';
import { destinoDe } from '@/features/notificaciones/push';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';
import type {
  ConversacionDetalle,
  DatosNotificacion,
  Notificacion,
  TipoNotificacion,
} from '@/types/dominio';

type Pestania = 'novedades' | 'mensajes';

const ICONO: Record<TipoNotificacion, ComponentProps<typeof Ionicons>['name']> = {
  coincidencia: 'git-compare',
  avistamiento: 'eye',
  estado: 'heart',
  mensaje: 'chatbubble',
};

export default function PantallaActividad() {
  const { usuario, cargando } = useAuth();
  const [pestania, setPestania] = useState<Pestania>('novedades');

  if (cargando) return <Pantalla>{null}</Pantalla>;
  if (!usuario) {
    return (
      <Pantalla>
        <RequiereCuenta mensaje={t.actividad.requiereCuenta} />
      </Pantalla>
    );
  }

  return (
    <Pantalla scroll>
      <Texto variante="titulo">{t.actividad.titulo}</Texto>
      <Chips
        opciones={[
          { valor: 'novedades', etiqueta: t.actividad.novedades },
          { valor: 'mensajes', etiqueta: t.actividad.mensajes },
        ]}
        valor={pestania}
        onCambio={setPestania}
      />
      {pestania === 'novedades' ? <Novedades usuarioId={usuario.id} /> : <Conversaciones />}
    </Pantalla>
  );
}

function Novedades({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const notificaciones = useNotificaciones(true);
  const marcarLeida = useMarcarLeida();
  const marcarTodas = useMarcarTodasLeidas(usuarioId);

  if (notificaciones.isPending) return <Cargando />;
  if (notificaciones.isError) {
    return (
      <Mensaje
        texto={notificaciones.error.message}
        tipo="error"
        onReintentar={() => void notificaciones.refetch()}
      />
    );
  }
  if (notificaciones.data.length === 0) {
    return <Texto variante="secundario">{t.actividad.sinNovedades}</Texto>;
  }

  const noLeidas = notificaciones.data.filter((n) => !n.leida_en).length;

  const abrir = (n: Notificacion) => {
    if (!n.leida_en) marcarLeida.mutate(n.id);
    router.push(destinoDe((n.datos ?? {}) as DatosNotificacion));
  };

  return (
    <View style={estilos.lista}>
      {noLeidas > 0 ? (
        <Boton
          titulo={t.actividad.marcarTodasLeidas}
          variante="fantasma"
          icono="checkmark-done"
          cargando={marcarTodas.isPending}
          onPress={() => marcarTodas.mutate()}
        />
      ) : null}
      {notificaciones.data.map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          onPress={() => abrir(n)}
          style={[estilos.fila, !n.leida_en && estilos.filaNoLeida]}>
          <View style={estilos.icono}>
            <Ionicons name={ICONO[n.tipo]} size={18} color={Colores.primario} />
          </View>
          <View style={estilos.cuerpo}>
            <Texto style={estilos.titulo}>{n.titulo}</Texto>
            <Texto variante="secundario">{n.cuerpo}</Texto>
            <Texto variante="pequeno">{haceCuanto(n.created_at)}</Texto>
          </View>
          {!n.leida_en ? <View style={estilos.punto} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function Conversaciones() {
  const router = useRouter();
  const conversaciones = useConversaciones(true);

  if (conversaciones.isPending) return <Cargando />;
  if (conversaciones.isError) {
    return (
      <Mensaje
        texto={conversaciones.error.message}
        tipo="error"
        onReintentar={() => void conversaciones.refetch()}
      />
    );
  }
  if (conversaciones.data.length === 0) {
    return <Texto variante="secundario">{t.actividad.sinMensajes}</Texto>;
  }

  return (
    <View style={estilos.lista}>
      {conversaciones.data.map((c: ConversacionDetalle) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/conversacion/[id]', params: { id: c.id } })}
          style={[estilos.fila, c.no_leidos > 0 && estilos.filaNoLeida]}>
          <Image
            source={{ uri: urlFoto(c.animal_foto_path) }}
            style={estilos.foto}
            contentFit="cover"
          />
          <View style={estilos.cuerpo}>
            <Texto style={estilos.titulo}>{c.otro_nombre}</Texto>
            <Texto variante="secundario" numberOfLines={1}>
              {c.ultimo_mensaje ?? t.actividad.sinMensajesAun}
            </Texto>
            <Texto variante="pequeno">
              {t.especie[c.animal_especie]}
              {c.ultimo_mensaje_en ? ` · ${haceCuanto(c.ultimo_mensaje_en)}` : ''}
            </Texto>
          </View>
          {c.no_leidos > 0 ? (
            <View style={estilos.contador}>
              <Texto variante="pequeno" style={estilos.contadorTexto}>
                {c.no_leidos}
              </Texto>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: Espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.m,
    padding: Espacio.m,
    borderRadius: Radio.m,
    backgroundColor: Colores.fondoSuave,
  },
  filaNoLeida: { backgroundColor: Colores.primarioSuave },
  icono: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.fondo,
  },
  foto: { width: 48, height: 48, borderRadius: Radio.s, backgroundColor: Colores.borde },
  cuerpo: { flex: 1, gap: 2 },
  titulo: { fontWeight: '600' },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colores.primario },
  contador: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.primario,
  },
  contadorTexto: { color: Colores.textoInvertido, fontWeight: '700' },
});

import { Image } from 'expo-image';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  type ImageStyle,
  ScrollView,
  type StyleProp,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonesCaso, NovedadesCaso, useAccionesCaso } from '@/components/reportes/AccionesCaso';
import { Coincidencias } from '@/components/reportes/Coincidencias';
import { Historial } from '@/components/reportes/Historial';
import { VistoPorUltimaVez } from '@/components/reportes/VistoPorUltimaVez';
import { AvisoEstafa } from '@/components/ui/AvisoEstafa';
import { BotonRedondo } from '@/components/ui/BotonRedondo';
import { ChipDato } from '@/components/ui/ChipDato';
import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Margen, Radio } from '@/constants/tema';
import { useDisposicion } from '@/hooks/useDisposicion';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';
import type {
  AnimalDetalle,
  AvistamientoDetalle,
  CambioEstadoDetalle,
  EventoHistorial,
} from '@/types/dominio';

type Props = {
  animal: AnimalDetalle;
  /** Más nuevo primero. */
  avistamientos: AvistamientoDetalle[];
  /** Más nuevo primero. */
  cambios: CambioEstadoDetalle[];
  historial: {
    eventos: EventoHistorial[];
    cargando: boolean;
    error: string | null;
    onReintentar: () => void;
  };
  onVolver: () => void;
};

/**
 * Detalle de un caso (docs/DISENO.md, 7.2 y 8.2). Celular: foto de cabecera y
 * barra de acciones fija. Tablet: columna centrada de 640. Computadora: dos columnas.
 */
export function DetalleCaso({ animal: a, avistamientos, cambios, historial, onVolver }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const disposicion = useDisposicion();
  const medio = disposicion === 'medio';
  const [altoBarra, setAltoBarra] = useState(0);

  // Último cambio a "resguardado": quién lo tiene y el contacto que eligió compartir.
  const resguardo =
    a.estado === 'resguardado'
      ? (cambios.find((cambio) => cambio.estado_nuevo === 'resguardado') ?? null)
      : null;
  const contacto = resguardo?.contacto_compartido ?? null;
  const acciones = useAccionesCaso(a, resguardo);
  const abierto = a.estado === 'avistado' || a.estado === 'resguardado';
  const hayBotones = acciones.puedeEscribir || acciones.puedeVerlo;

  const titulo = t.animal.tituloCorto(a.especie, a.color, a.tamanio);
  const datos = [
    t.especie[a.especie],
    a.tamanio ? t.tamanio[a.tamanio] : null,
    a.color,
    a.tiene_collar ? t.animal.conCollar : t.animal.sinCollar,
  ].filter((dato): dato is string => !!dato);

  const foto = (estilo: StyleProp<ImageStyle>) => (
    // La foto nunca se oscurece ni se filtra, tampoco en modo oscuro.
    <Image
      source={{ uri: urlFoto(a.foto_principal_path) }}
      style={[estilos.foto, estilo]}
      contentFit="cover"
      accessible
      accessibilityLabel={titulo}
      accessibilityIgnoresInvertColors
    />
  );

  const botonesFlotantes = (
    <View style={estilos.flotantes}>
      <BotonRedondo icono="chevron-back" accessibilityLabel={t.comunes.volver} onPress={onVolver} />
      <View style={estilos.flotantesDerecha}>
        <BotonRedondo
          icono={acciones.siguiendo ? 'notifications' : 'notifications-outline'}
          color={acciones.siguiendo ? 'primario' : 'texto'}
          accessibilityLabel={
            acciones.siguiendo ? t.animal.acciones.siguiendo : t.animal.acciones.seguir
          }
          seleccionado={acciones.siguiendo}
          cargando={acciones.cambiandoSeguimiento}
          onPress={acciones.seguir}
        />
        <BotonRedondo
          icono="ellipsis-horizontal"
          accessibilityLabel={t.animal.masOpciones}
          onPress={acciones.abrirOpciones}
        />
      </View>
    </View>
  );

  const contenido = (
    <>
      {a.oculto ? <Mensaje texto={t.animal.oculto} tipo="error" /> : null}
      {a.estado === 'reunido' ? <Mensaje texto={t.animal.casoCerrado} tipo="exito" /> : null}
      <View style={estilos.filaEstado}>
        <EtiquetaEstado estado={a.estado} />
        <Texto variante="secundario">{t.animal.publicado(haceCuanto(a.created_at))}</Texto>
      </View>
      <Texto variante="display" accessibilityRole="header">
        {titulo}
      </Texto>
      {a.descripcion ? <Texto color="textoCuerpo">{a.descripcion}</Texto> : null}
      <View style={estilos.datos}>
        {datos.map((dato) => (
          <ChipDato key={dato} texto={dato} />
        ))}
      </View>
      {contacto ? (
        <View style={estilos.contacto}>
          <Texto variante="etiquetaCampo">{t.animal.contacto}</Texto>
          <Texto variante="cuerpoFuerte" selectable>
            {contacto}
          </Texto>
        </View>
      ) : null}
      <NovedadesCaso acciones={acciones} />
      <VistoPorUltimaVez avistamientos={avistamientos} estado={a.estado} />
      {a.estado !== 'reunido' ? <Coincidencias animalId={a.id} /> : null}
      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {t.animal.historial}
        </Texto>
        {historial.cargando ? (
          <ActivityIndicator color={c.primario} style={estilos.cargando} />
        ) : historial.error ? (
          <Mensaje texto={historial.error} tipo="error" onReintentar={historial.onReintentar} />
        ) : (
          <Historial eventos={historial.eventos} estado={a.estado} />
        )}
      </View>
    </>
  );

  if (disposicion === 'amplio') {
    return (
      <View style={estilos.raiz}>
        <ScrollView contentContainerStyle={estilos.scrollAmplio}>
          <View style={estilos.dosColumnas}>
            <View style={estilos.columnaIzquierda}>
              <View>
                {foto(estilos.fotoCuadrada)}
                <View style={estilos.flotantesSobreFoto}>{botonesFlotantes}</View>
              </View>
              {hayBotones ? <BotonesCaso acciones={acciones} /> : null}
              {abierto ? <AvisoEstafa /> : null}
            </View>
            <View style={estilos.columnaDerecha}>{contenido}</View>
          </View>
        </ScrollView>
        {acciones.modales}
      </View>
    );
  }

  const altoFoto = Math.round(Math.min(380, height * 0.45));

  return (
    <View style={estilos.raiz}>
      {/* Antes que el contenido en el árbol, para que Volver sea lo primero al navegar con Tab. */}
      <View
        style={[
          estilos.capaFlotantes,
          medio ? estilos.capaFlotantesMedio : estilos.capaFlotantesCompacta,
          { top: insets.top + (medio ? Espacio.m + Espacio.sm : Espacio.s) },
        ]}>
        <View style={medio ? estilos.columnaFlotantesMedio : null}>{botonesFlotantes}</View>
      </View>

      <ScrollView
        contentContainerStyle={[
          medio ? [estilos.scrollMedio, { paddingTop: insets.top + Espacio.m }] : null,
          { paddingBottom: (hayBotones ? altoBarra : insets.bottom) + Espacio.l },
        ]}>
        <View style={medio ? estilos.columnaMedio : null}>
          {foto(
            medio
              ? [estilos.fotoMedio, { height: altoFoto }]
              : [estilos.fotoCabecera, { height: altoFoto }],
          )}
          <View style={[estilos.contenido, medio && estilos.contenidoMedio]}>
            {contenido}
            {abierto ? <AvisoEstafa /> : null}
          </View>
        </View>
      </ScrollView>

      {hayBotones ? (
        <View
          style={[estilos.barra, { paddingBottom: insets.bottom + Espacio.sm }]}
          onLayout={(evento) => setAltoBarra(evento.nativeEvent.layout.height)}>
          <View style={estilos.columnaBarra}>
            <BotonesCaso acciones={acciones} />
          </View>
        </View>
      ) : null}
      {acciones.modales}
    </View>
  );
}

/** Estados sin caso para mostrar (error, no encontrado, vinculado), con su botón de volver. */
export function AvisoCaso({ children, onVolver }: { children: ReactNode; onVolver: () => void }) {
  return (
    <Pantalla scroll ancho={AnchoMaximo.detalle}>
      <BotonRedondo
        icono="chevron-back"
        accessibilityLabel={t.comunes.volver}
        onPress={onVolver}
        flotante={false}
      />
      {children}
    </Pantalla>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.fondo },
  foto: { backgroundColor: c.superficieSuave },
  fotoCabecera: {
    width: '100%',
    borderBottomLeftRadius: Radio.cabecera,
    borderBottomRightRadius: Radio.cabecera,
  },
  fotoMedio: { width: '100%', borderRadius: Radio.hoja },
  fotoCuadrada: { width: '100%', aspectRatio: 1, borderRadius: Radio.hoja },
  capaFlotantes: { position: 'absolute', left: 0, right: 0, zIndex: 1, pointerEvents: 'box-none' },
  capaFlotantesCompacta: { paddingHorizontal: Espacio.m },
  capaFlotantesMedio: { paddingHorizontal: Margen.pantalla },
  columnaFlotantesMedio: {
    width: '100%',
    maxWidth: AnchoMaximo.detalle,
    alignSelf: 'center',
    paddingHorizontal: Espacio.sm,
    pointerEvents: 'box-none',
  },
  flotantes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  flotantesDerecha: { flexDirection: 'row', gap: Espacio.sm },
  flotantesSobreFoto: { position: 'absolute', top: Espacio.m, left: Espacio.m, right: Espacio.m },
  scrollMedio: { paddingHorizontal: Margen.pantalla },
  columnaMedio: { width: '100%', maxWidth: AnchoMaximo.detalle, alignSelf: 'center' },
  contenido: { gap: Espacio.m, padding: Margen.pantalla },
  contenidoMedio: { paddingHorizontal: 0 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Espacio.sm },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  contacto: {
    gap: Espacio.xs,
    padding: Espacio.m,
    borderRadius: Radio.l,
    backgroundColor: c.superficieSuave,
  },
  seccion: { gap: Espacio.m },
  cargando: { alignSelf: 'flex-start' },
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Espacio.sm,
    paddingHorizontal: Margen.pantalla,
    borderTopWidth: 1,
    borderTopColor: c.borde,
    backgroundColor: c.superficie,
  },
  columnaBarra: { width: '100%', maxWidth: AnchoMaximo.detalle, alignSelf: 'center' },
  scrollAmplio: { flexGrow: 1 },
  dosColumnas: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Espacio.xl,
    width: '100%',
    maxWidth: AnchoMaximo.detalleAmplio,
    alignSelf: 'center',
    padding: Espacio.xl,
  },
  columnaIzquierda: { width: '46%', gap: Espacio.m },
  columnaDerecha: { flex: 1, gap: Espacio.m, minWidth: 0 },
}));

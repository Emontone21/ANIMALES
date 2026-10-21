import type Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';

import { HojaTerminos } from '@/components/legal/AceptarTerminos';
import { ModalAvistamiento } from '@/components/reportes/ModalAvistamiento';
import { ModalDenuncia } from '@/components/reportes/ModalDenuncia';
import { ModalEstado, type TipoCambio } from '@/components/reportes/ModalEstado';
import { Boton } from '@/components/ui/Boton';
import { MenuOpciones } from '@/components/ui/MenuOpciones';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDenuncia } from '@/features/denuncias/api';
import { useTerminos } from '@/features/legal/terminos';
import { useAbrirConversacion } from '@/features/mensajes/api';
import { useBorrarReporte } from '@/features/reportes/api';
import {
  aQuienesLoVieron,
  avisosDeOtros,
  type CambioDisponible,
  cambiosDisponibles,
  destinatariosDelCaso,
  permisosDelCaso,
} from '@/features/reportes/permisos';
import { useSeguimiento } from '@/features/seguimientos/api';
import { cerrarYNavegar } from '@/hooks/useCerrarConAtras';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { datosParaCompartir, mensajeParaCompartir } from '@/lib/compartir';
import { mensajeDeError } from '@/lib/errores';
import { ErrorFotos } from '@/lib/fotos';
import { abrirHojaCompartir, abrirWhatsApp, copiarLink } from '@/lib/hojaCompartir';
import type { AnimalDetalle, AvistamientoDetalle, CambioEstadoDetalle } from '@/types/dominio';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

type ModalCaso =
  | 'avistamiento'
  | 'denuncia'
  | TipoCambio
  | 'opciones'
  | 'compartir'
  | 'borrar'
  | 'destinatario'
  | 'cuenta'
  | 'terminos'
  | null;

type Novedad = { tipo: TipoCambio; titulo: string; icono: NombreIcono };

const NOVEDADES: Record<CambioDisponible, Novedad> = {
  resguardar: { tipo: 'resguardar', titulo: t.animal.acciones.resguardar, icono: 'home-outline' },
  reabrir: { tipo: 'reabrir', titulo: t.animal.acciones.reabrir, icono: 'refresh-outline' },
  reunido: { tipo: 'reunido', titulo: t.animal.acciones.reunido, icono: 'heart-outline' },
};

const DURACION_AVISO = 6000;

/**
 * Estado y reglas de las acciones del detalle de un caso: lo vi, novedades del
 * caso, seguir, compartir, editar, borrar, denunciar y escribir. Quién ve cada
 * acción sigue las reglas de siempre.
 */
export function useAccionesCaso(
  animal: AnimalDetalle,
  resguardo: CambioEstadoDetalle | null,
  avistamientos: AvistamientoDetalle[],
) {
  const router = useRouter();
  const { usuario } = useAuth();
  const [modal, setModal] = useState<ModalCaso>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorEscribir, setErrorEscribir] = useState<string | null>(null);
  // Escribir desde el historial: el indicador y el error van en la fila de esa persona.
  const [desdeHistorial, setDesdeHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<{ usuarioId: string; texto: string } | null>(
    null,
  );
  // Sin cuenta: el motivo que se muestra depende de la acción que se tocó.
  const [motivoCuenta, setMotivoCuenta] = useState<string>(t.animal.requiereCuentaAcciones);
  const seguimiento = useSeguimiento(usuario?.id, animal.id);
  const denuncia = useDenuncia(usuario?.id, animal.id);
  const conversacion = useAbrirConversacion();
  const terminos = useTerminos(usuario?.id);
  const borrar = useBorrarReporte(animal);
  // Resultado de copiar el link en la hoja de compartir (cuando no hay hoja del sistema).
  const [avisoCopia, setAvisoCopia] = useState<{ texto: string; ok: boolean } | null>(null);
  // Lo que quiso hacer antes de aceptar los términos: se retoma al aceptarlos.
  const [pendiente, setPendiente] = useState<(() => void) | null>(null);

  // El aviso de éxito se va solo.
  useEffect(() => {
    if (!aviso) return;
    const reloj = setTimeout(() => setAviso(null), DURACION_AVISO);
    return () => clearTimeout(reloj);
  }, [aviso]);

  // Las mismas reglas que la base (src/features/reportes/permisos.ts).
  const permisos = permisosDelCaso(animal, usuario?.id, resguardo?.usuario_id);
  const { abierto, puedeGestionar } = permisos;
  // Lo que se pierde al borrarlo: los avisos de otras personas que lo vieron.
  const avisosOtros = avisosDeOtros(avistamientos, animal.creado_por);
  const mensajeCompartir = mensajeParaCompartir(animal.id, datosParaCompartir(animal));

  const novedades: Novedad[] = usuario
    ? cambiosDisponibles(animal, permisos).map((tipo) => NOVEDADES[tipo])
    : [];

  const destinatarios = destinatariosDelCaso(animal, resguardo?.usuario_id, usuario?.id);
  // Quien publicó el caso (o un reporte unido) le escribe a quien lo vio.
  const quienesLoVieron = aQuienesLoVieron(animal, avistamientos, usuario?.id);

  /** Sin cuenta, toda acción lleva a ingresar o crear una cuenta. */
  const pedirCuenta = (motivo: string = t.animal.requiereCuentaAcciones) => {
    setMotivoCuenta(motivo);
    setModal('cuenta');
  };

  /**
   * Publicar, avisar, cambiar el estado, escribir y denunciar piden los
   * términos aceptados (la base también lo exige). Si faltan, se aceptan
   * primero y después sigue lo que se había tocado. Mientras se consulta, sigue.
   */
  const conTerminos = (accion: () => void) => {
    if (terminos.cargando || terminos.aceptados) return accion();
    setPendiente(() => accion);
    setModal('terminos');
  };

  const pedir = (siguiente: Exclude<ModalCaso, null>) =>
    usuario ? conTerminos(() => setModal(siguiente)) : pedirCuenta();

  const escribirA = (otroUsuarioId: string, historial = false) => {
    setErrorEscribir(null);
    setErrorHistorial(null);
    setDesdeHistorial(historial);
    conversacion.mutate(
      { animalId: animal.id, otroUsuarioId },
      {
        onSuccess: (id) =>
          cerrarYNavegar(
            () => setModal(null),
            () => router.push({ pathname: '/conversacion/[id]', params: { id } }),
          ),
        onError: (e) =>
          historial
            ? setErrorHistorial({ usuarioId: otroUsuarioId, texto: mensajeDeError(e) })
            : setErrorEscribir(mensajeDeError(e)),
      },
    );
  };

  /** "Escribirle" en el historial, junto al aviso de alguien que lo vio. */
  const escribirleAQuienLoVio = (otroUsuarioId: string) =>
    conTerminos(() => escribirA(otroUsuarioId, true));

  const escribir = () => {
    if (!usuario) return pedirCuenta(t.mensajes.requiereCuenta);
    conTerminos(() => {
      if (destinatarios.length > 1) return setModal('destinatario');
      if (destinatarios[0]) escribirA(destinatarios[0].usuarioId);
    });
  };

  const seguir = () => {
    if (!usuario) return pedirCuenta();
    seguimiento.alternar.mutate();
  };

  /** La hoja del sistema; si no hay (computadora), WhatsApp y copiar el link. */
  const compartir = async () => {
    const resultado = await abrirHojaCompartir(mensajeCompartir);
    if (resultado === 'sinHoja') {
      setAvisoCopia(null);
      setModal('compartir');
    }
  };

  const copiar = async () => {
    const ok = await copiarLink(mensajeCompartir.url);
    setAvisoCopia({ ok, texto: ok ? t.compartir.copiado : t.compartir.errorCopiar });
  };

  const editarReporte = () =>
    cerrarYNavegar(
      () => setModal(null),
      () => router.push({ pathname: '/animal/[id]/editar', params: { id: animal.id } }),
    );

  const confirmarBorrado = () => {
    borrar.reset();
    setModal('borrar');
  };

  const borrarReporte = () =>
    borrar.mutate(undefined, {
      onSuccess: () =>
        cerrarYNavegar(
          () => setModal(null),
          () => router.replace('/'),
        ),
    });

  const errorBorrar = borrar.isError
    ? borrar.error instanceof ErrorFotos
      ? t.borrarReporte.errorFotos
      : mensajeDeError(borrar.error)
    : null;

  const cerrarConAviso = (texto: string) => {
    setModal(null);
    setAviso(texto);
  };

  const irA = (ruta: '/auth/ingresar' | '/auth/registrarse') =>
    cerrarYNavegar(
      () => setModal(null),
      () => router.push(ruta),
    );

  const modales: ReactNode = (
    <>
      {usuario ? (
        <>
          <ModalAvistamiento
            visible={modal === 'avistamiento'}
            animalId={animal.id}
            usuarioId={usuario.id}
            onCerrar={() => setModal(null)}
            onExito={() => cerrarConAviso(t.animal.modalAvistamiento.exito)}
          />
          {modal === 'resguardar' || modal === 'reunido' || modal === 'reabrir' ? (
            <ModalEstado
              visible
              tipo={modal}
              animalId={animal.id}
              tipoReporte={animal.tipo_reporte}
              usuarioId={usuario.id}
              onCerrar={() => setModal(null)}
              onExito={() => cerrarConAviso(t.comunes.listo)}
            />
          ) : null}
          <HojaTerminos
            visible={modal === 'terminos'}
            usuarioId={usuario.id}
            onCerrar={() => {
              setPendiente(null);
              setModal(null);
            }}
            onAceptado={() => {
              setModal(null);
              const accion = pendiente;
              setPendiente(null);
              accion?.();
            }}
          />
          <ModalDenuncia
            visible={modal === 'denuncia'}
            animalId={animal.id}
            usuarioId={usuario.id}
            onCerrar={() => setModal(null)}
            onExito={() => cerrarConAviso(t.animal.modalDenuncia.exito)}
          />
        </>
      ) : null}
      <MenuOpciones
        visible={modal === 'opciones'}
        titulo={t.animal.masOpciones}
        onCerrar={() => setModal(null)}
        opciones={[
          ...(puedeGestionar
            ? [
                {
                  titulo: t.animal.acciones.editar,
                  icono: 'create-outline' as const,
                  onPress: editarReporte,
                },
                {
                  titulo: t.animal.acciones.borrar,
                  icono: 'trash-outline' as const,
                  variante: 'peligro' as const,
                  onPress: confirmarBorrado,
                },
              ]
            : []),
          {
            titulo: denuncia.yaDenuncio
              ? t.animal.acciones.denunciado
              : t.animal.acciones.denunciar,
            icono: 'flag-outline',
            variante: 'peligro',
            deshabilitado: denuncia.yaDenuncio,
            onPress: () => pedir('denuncia'),
          },
        ]}
      />
      <MenuOpciones
        visible={modal === 'borrar'}
        titulo={t.borrarReporte.titulo}
        descripcion={t.borrarReporte.detalle(avisosOtros)}
        error={errorBorrar}
        onCerrar={() => setModal(null)}
        opciones={[
          {
            titulo: t.borrarReporte.boton,
            icono: 'trash-outline',
            variante: 'peligro',
            cargando: borrar.isPending,
            onPress: borrarReporte,
          },
        ]}
      />
      <MenuOpciones
        visible={modal === 'compartir'}
        titulo={t.compartir.titulo}
        descripcion={t.compartir.intro}
        contenido={
          <View style={estilosLink.contenido}>
            <Texto variante="cuerpoFuerte" selectable>
              {mensajeCompartir.url}
            </Texto>
            {avisoCopia ? (
              <Mensaje texto={avisoCopia.texto} tipo={avisoCopia.ok ? 'exito' : 'error'} />
            ) : null}
          </View>
        }
        onCerrar={() => setModal(null)}
        opciones={[
          {
            titulo: t.compartir.whatsapp,
            icono: 'logo-whatsapp',
            variante: 'primario',
            onPress: () => abrirWhatsApp(mensajeCompartir),
          },
          { titulo: t.compartir.copiar, icono: 'copy-outline', onPress: () => void copiar() },
        ]}
      />
      <MenuOpciones
        visible={modal === 'destinatario'}
        titulo={t.mensajes.elegirDestinatario}
        descripcion={t.mensajes.aviso}
        error={errorEscribir}
        onCerrar={() => setModal(null)}
        opciones={destinatarios.map((d) => ({
          titulo: d.titulo,
          icono: 'chatbubble-outline',
          cargando: conversacion.isPending && conversacion.variables?.otroUsuarioId === d.usuarioId,
          deshabilitado: conversacion.isPending,
          onPress: () => escribirA(d.usuarioId),
        }))}
      />
      <MenuOpciones
        visible={modal === 'cuenta'}
        titulo={t.auth.requiereCuentaTitulo}
        descripcion={motivoCuenta}
        onCerrar={() => setModal(null)}
        opciones={[
          { titulo: t.auth.ingresar, variante: 'primario', onPress: () => irA('/auth/ingresar') },
          { titulo: t.auth.registrarse, onPress: () => irA('/auth/registrarse') },
        ]}
      />
    </>
  );

  return {
    usuario,
    /** "Lo vi" solo en casos abiertos. */
    puedeVerlo: abierto,
    /** Sin cuenta se muestra igual y lleva a ingresar. */
    puedeEscribir: !usuario || destinatarios.length > 0,
    escribiendo: conversacion.isPending && modal !== 'destinatario' && !desdeHistorial,
    errorEscribir: modal === 'destinatario' ? null : errorEscribir,
    aviso,
    novedades,
    siguiendo: seguimiento.sigue,
    cambiandoSeguimiento: seguimiento.alternar.isPending,
    loVi: () => pedir('avistamiento'),
    cambiarEstado: (tipo: TipoCambio) => pedir(tipo),
    abrirOpciones: () => setModal('opciones'),
    puedeCompartir: permisos.puedeCompartir,
    compartir: () => void compartir(),
    escribir,
    seguir,
    modales,
    /** Para el historial: a quiénes de los que lo vieron se les puede escribir. */
    historial: {
      escribibles: quienesLoVieron,
      escribir: escribirleAQuienLoVio,
      escribiendoA:
        conversacion.isPending && desdeHistorial
          ? (conversacion.variables?.otroUsuarioId ?? null)
          : null,
      error: errorHistorial,
    },
  };
}

export type AccionesCaso = ReturnType<typeof useAccionesCaso>;

/**
 * Escribir y Lo vi (6.13). En celular y tablet va fija abajo; en computadora,
 * debajo de la foto.
 */
export function BotonesCaso({ acciones }: { acciones: AccionesCaso }) {
  const estilos = useEstilos(crear);
  if (!acciones.puedeEscribir && !acciones.puedeVerlo) return null;
  return (
    <View style={estilos.botonesCaso}>
      {acciones.aviso ? <Mensaje texto={acciones.aviso} tipo="exito" /> : null}
      {acciones.errorEscribir ? <Mensaje texto={acciones.errorEscribir} tipo="error" /> : null}
      <View style={estilos.fila}>
        {acciones.puedeEscribir ? (
          <Boton
            titulo={t.mensajes.escribir}
            icono="chatbubble-outline"
            variante="secundario"
            cargando={acciones.escribiendo}
            onPress={acciones.escribir}
            style={estilos.escribir}
          />
        ) : null}
        {acciones.puedeVerlo ? (
          <Boton
            titulo={t.animal.acciones.loVi}
            icono="eye-outline"
            onPress={acciones.loVi}
            style={estilos.loVi}
          />
        ) : null}
      </View>
    </View>
  );
}

/** "Novedades del caso": resguardado, reunido y reabrir, según quién mira (7.2). */
export function NovedadesCaso({ acciones }: { acciones: AccionesCaso }) {
  const estilos = useEstilos(crear);
  if (acciones.novedades.length === 0) return null;
  return (
    <View style={estilos.novedades}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {t.animal.novedades}
      </Texto>
      {acciones.novedades.map((novedad) => (
        <Boton
          key={novedad.tipo}
          titulo={novedad.titulo}
          icono={novedad.icono}
          variante="secundario"
          onPress={() => acciones.cambiarEstado(novedad.tipo)}
        />
      ))}
    </View>
  );
}

const estilosLink = { contenido: { gap: Espacio.s } } as const;

const crear = crearEstilos(() => ({
  botonesCaso: { gap: Espacio.s },
  fila: { flexDirection: 'row', gap: Espacio.sm },
  escribir: { flex: 1 },
  loVi: { flex: 1.4 },
  novedades: { gap: Espacio.s },
}));

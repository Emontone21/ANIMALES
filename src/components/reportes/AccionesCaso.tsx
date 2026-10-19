import type { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';

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
import { useAbrirConversacion } from '@/features/mensajes/api';
import { useSeguimiento } from '@/features/seguimientos/api';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { AnimalDetalle, CambioEstadoDetalle } from '@/types/dominio';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

type ModalCaso =
  'avistamiento' | 'denuncia' | TipoCambio | 'opciones' | 'destinatario' | 'cuenta' | null;

type Novedad = { tipo: TipoCambio; titulo: string; icono: NombreIcono };

type Destinatario = { usuarioId: string; titulo: string };

const DURACION_AVISO = 6000;

/**
 * Estado y reglas de las acciones del detalle de un caso: lo vi, novedades del
 * caso, seguir, denunciar y escribir. Quién ve cada acción sigue las reglas de siempre.
 */
export function useAccionesCaso(animal: AnimalDetalle, resguardo: CambioEstadoDetalle | null) {
  const router = useRouter();
  const { usuario } = useAuth();
  const [modal, setModal] = useState<ModalCaso>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorEscribir, setErrorEscribir] = useState<string | null>(null);
  // Sin cuenta: el motivo que se muestra depende de la acción que se tocó.
  const [motivoCuenta, setMotivoCuenta] = useState<string>(t.animal.requiereCuentaAcciones);
  const seguimiento = useSeguimiento(usuario?.id, animal.id);
  const denuncia = useDenuncia(usuario?.id, animal.id);
  const conversacion = useAbrirConversacion();

  // El aviso de éxito se va solo.
  useEffect(() => {
    if (!aviso) return;
    const reloj = setTimeout(() => setAviso(null), DURACION_AVISO);
    return () => clearTimeout(reloj);
  }, [aviso]);

  const abierto = animal.estado === 'avistado' || animal.estado === 'resguardado';
  const esCreador = !!usuario && animal.creado_por === usuario.id;
  const esPerdido = animal.tipo_reporte === 'perdido';
  // Quien lo tiene resguardado ahora (solo existe si el caso está resguardado).
  const esQuienResguarda = !!usuario && resguardo?.usuario_id === usuario.id;

  // Las mismas reglas que cambiar_estado_animal (migración 0010).
  const puedeResguardar = animal.estado === 'avistado' && !(esPerdido && esCreador);
  const puedeReunir =
    abierto && (esCreador || (!esPerdido && animal.estado === 'resguardado' && esQuienResguarda));
  const puedeReabrir =
    (animal.estado === 'resguardado' && (!esPerdido || esCreador)) ||
    (animal.estado === 'reunido' && esCreador);

  const novedades: Novedad[] = [];
  if (usuario) {
    if (puedeResguardar) {
      novedades.push({
        tipo: 'resguardar',
        titulo: t.animal.acciones.resguardar,
        icono: 'home-outline',
      });
    }
    if (puedeReabrir && animal.estado === 'resguardado') {
      novedades.push({
        tipo: 'reabrir',
        titulo: t.animal.acciones.reabrir,
        icono: 'refresh-outline',
      });
    }
    if (puedeReunir) {
      novedades.push({
        tipo: 'reunido',
        titulo: t.animal.acciones.reunido,
        icono: 'heart-outline',
      });
    }
    if (puedeReabrir && animal.estado === 'reunido') {
      novedades.push({
        tipo: 'reabrir',
        titulo: t.animal.acciones.reabrir,
        icono: 'refresh-outline',
      });
    }
  }

  // Quien publicó y, si es otra persona, quien lo resguarda. Nunca uno mismo.
  const destinatarios: Destinatario[] = [
    {
      usuarioId: animal.creado_por,
      titulo: esPerdido ? t.mensajes.escribirAFamilia : t.mensajes.escribirAPublicador,
    },
    ...(resguardo && resguardo.usuario_id !== animal.creado_por
      ? [{ usuarioId: resguardo.usuario_id, titulo: t.mensajes.escribirAResguardo }]
      : []),
  ].filter((d) => d.usuarioId !== usuario?.id);

  /** Sin cuenta, toda acción lleva a ingresar o crear una cuenta. */
  const pedirCuenta = (motivo: string = t.animal.requiereCuentaAcciones) => {
    setMotivoCuenta(motivo);
    setModal('cuenta');
  };

  const pedir = (siguiente: Exclude<ModalCaso, null>) =>
    usuario ? setModal(siguiente) : pedirCuenta();

  const escribirA = (otroUsuarioId: string) => {
    setErrorEscribir(null);
    conversacion.mutate(
      { animalId: animal.id, otroUsuarioId },
      {
        onSuccess: (id) => {
          setModal(null);
          router.push({ pathname: '/conversacion/[id]', params: { id } });
        },
        onError: (e) => setErrorEscribir(e.message || t.comunes.errorGenerico),
      },
    );
  };

  const escribir = () => {
    if (!usuario) return pedirCuenta(t.mensajes.requiereCuenta);
    if (destinatarios.length > 1) return setModal('destinatario');
    if (destinatarios[0]) escribirA(destinatarios[0].usuarioId);
  };

  const seguir = () => {
    if (!usuario) return pedirCuenta();
    seguimiento.alternar.mutate();
  };

  const cerrarConAviso = (texto: string) => {
    setModal(null);
    setAviso(texto);
  };

  const irA = (ruta: '/auth/ingresar' | '/auth/registrarse') => {
    setModal(null);
    router.push(ruta);
  };

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
              onCerrar={() => setModal(null)}
              onExito={() => cerrarConAviso(t.comunes.listo)}
            />
          ) : null}
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
    escribiendo: conversacion.isPending && modal !== 'destinatario',
    errorEscribir: modal === 'destinatario' ? null : errorEscribir,
    aviso,
    novedades,
    siguiendo: seguimiento.sigue,
    cambiandoSeguimiento: seguimiento.alternar.isPending,
    loVi: () => pedir('avistamiento'),
    cambiarEstado: (tipo: TipoCambio) => pedir(tipo),
    abrirOpciones: () => setModal('opciones'),
    escribir,
    seguir,
    modales,
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

const crear = crearEstilos(() => ({
  botonesCaso: { gap: Espacio.s },
  fila: { flexDirection: 'row', gap: Espacio.sm },
  escribir: { flex: 1 },
  loVi: { flex: 1.4 },
  novedades: { gap: Espacio.s },
}));

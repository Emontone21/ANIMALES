import { lazy, Suspense, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Interruptor } from '@/components/ui/Interruptor';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import type { AppConNavegador } from '@/features/instalar/formaDeInstalar';
import type { ComoDesbloquear, EstadoAvisos } from '@/features/notificaciones/formaDeAvisar';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/**
 * Notificaciones en el celular (solo web): el interruptor de Perfil y la
 * pregunta después de publicar (docs/DISENO.md, 6.17). Este archivo va en un
 * bloque aparte (lo cargan Perfil y el detalle con lazy) y el código del
 * navegador, en otro (celular.web.ts, con import()): ninguno entra en la
 * carga inicial.
 */

// Igual que en Perfil: la hoja de instalar es otro bloque aparte.
const HojaInstalar = lazy(() => import('@/components/instalar/HojaInstalar'));

const cargarCelular = () => import('@/features/notificaciones/celular');

/**
 * El permiso se pide en el mismo toque, antes de cualquier espera: Safari no
 * muestra la ventana si el pedido no viene directo de un toque.
 */
function pedirPermiso(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('default');
  return Notification.requestPermission();
}

type Situacion = {
  estado: EstadoAvisos;
  donde: ComoDesbloquear;
  app: AppConNavegador | null;
  /** Después de publicar: si se pregunta (o se explica cómo activarlas). */
  ofrecer: boolean;
};

/** Cómo está este navegador; se vuelve a leer al volver a la app (por ejemplo, de Ajustes). */
function useSituacion() {
  const [situacion, setSituacion] = useState<Situacion | null>(null);

  useEffect(() => {
    let activo = true;
    const leer = () =>
      cargarCelular()
        .then(async (celular) => {
          const estado = await celular.leerEstado(true);
          if (!activo) return;
          setSituacion({
            estado,
            donde: celular.dondeDesbloquear(),
            app: celular.appDelNavegador(),
            ofrecer: celular.ofrecerAlPublicar(estado),
          });
        })
        .catch(() => {
          if (activo) setSituacion(null);
        });
    void leer();
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      activo = false;
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  const cambiarEstado = (estado: EstadoAvisos) =>
    setSituacion((anterior) => (anterior ? { ...anterior, estado } : anterior));

  return { situacion, cambiarEstado };
}

/** Activa en este navegador: el permiso (en el toque) y la suscripción. */
async function activarAhora(): Promise<EstadoAvisos> {
  const permiso = pedirPermiso();
  const celular = await cargarCelular();
  return celular.activar(await permiso);
}

type Hoja = 'pasosIos' | 'abrirEnNavegador' | null;

/**
 * iPhone sin instalar o navegador de una app: qué hacer, con su botón. Sin
 * `onHoja` (en Perfil) va solo la explicación: el botón es "Instalar la app" de
 * Perfil, justo debajo, que abre la misma hoja (si no, aparecía dos veces).
 */
function ComoActivarlas({
  situacion,
  onHoja,
}: {
  situacion: Situacion;
  onHoja?: (hoja: Exclude<Hoja, null>) => void;
}) {
  if (situacion.estado === 'instalarPrimero') {
    return (
      <>
        <Texto variante="secundario">{t.celular.iphone}</Texto>
        {onHoja ? (
          <Boton
            titulo={t.instalar.boton}
            icono="download-outline"
            variante="secundario"
            onPress={() => onHoja('pasosIos')}
          />
        ) : null}
      </>
    );
  }
  if (situacion.estado === 'abrirEnNavegador') {
    return (
      <>
        <Texto variante="secundario">
          {t.celular.navegadorInterno(situacion.app ?? t.instalar.navegadorInterno.estaApp)}
        </Texto>
        {onHoja ? (
          <Boton
            titulo={t.celular.abrirEnNavegador}
            icono="open-outline"
            variante="secundario"
            onPress={() => onHoja('abrirEnNavegador')}
          />
        ) : null}
      </>
    );
  }
  return null;
}

function HojaParaActivar({
  hoja,
  app,
  onCerrar,
}: {
  hoja: Hoja;
  app: AppConNavegador | null;
  onCerrar: () => void;
}) {
  return (
    <Suspense fallback={null}>
      {hoja ? <HojaInstalar forma={hoja} app={app} onCerrar={onCerrar} /> : null}
    </Suspense>
  );
}

/** Perfil › La app: "Notificaciones en este celular". */
export function InterruptorAvisos() {
  const estilos = useEstilos(crear);
  const { situacion, cambiarEstado } = useSituacion();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'exito' | 'error' } | null>(null);

  if (!situacion || situacion.estado === 'sinConfigurar') return null;
  const { estado } = situacion;

  const cambiar = (prender: boolean) => {
    if (ocupado) return;
    setAviso(null);
    setOcupado(true);
    const accion = prender
      ? activarAhora().then((nuevo) => {
          cambiarEstado(nuevo);
          if (nuevo === 'activadas') setAviso({ texto: t.celular.activadas, tipo: 'exito' });
        })
      : cargarCelular()
          .then((celular) => celular.desactivar())
          .then(() => {
            cambiarEstado('ofrecer');
            setAviso({ texto: t.celular.desactivadas, tipo: 'exito' });
          });
    void accion
      .catch(() =>
        setAviso({ texto: prender ? t.celular.error : t.celular.errorDesactivar, tipo: 'error' }),
      )
      .finally(() => setOcupado(false));
  };

  return (
    <View style={estilos.bloque}>
      {estado === 'ofrecer' || estado === 'activadas' ? (
        <Interruptor
          etiqueta={t.celular.interruptor}
          valor={estado === 'activadas'}
          onCambio={cambiar}
        />
      ) : (
        <Texto variante="etiquetaCampo">{t.celular.interruptor}</Texto>
      )}
      <Texto variante="secundario">{t.celular.ayuda}</Texto>
      {/* Sin botón: el de instalar o abrir en el navegador es el de Perfil. */}
      <ComoActivarlas situacion={situacion} />
      {estado === 'bloqueadas' ? (
        <Mensaje texto={`${t.celular.bloqueadas} ${t.celular.comoDesbloquear[situacion.donde]}`} />
      ) : null}
      {estado === 'noSoportado' ? (
        <Texto variante="secundario">{t.celular.noSoportado}</Texto>
      ) : null}
      {aviso ? <Mensaje texto={aviso.texto} tipo={aviso.tipo} /> : null}
    </View>
  );
}

/**
 * Después de publicar un caso: "¿Querés que te avisemos al celular cuando
 * alguien lo vea?". Solo si todavía se pueden activar: si ya están activadas,
 * bloqueadas o el navegador no puede, no aparece.
 */
export function OfertaAvisos() {
  const estilos = useEstilos(crear);
  const { situacion, cambiarEstado } = useSituacion();
  const [respondida, setRespondida] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<'activadas' | 'error' | null>(null);
  const [hoja, setHoja] = useState<Hoja>(null);

  if (resultado === 'activadas') return <Mensaje texto={t.celular.activadas} tipo="exito" />;
  if (respondida || !situacion?.ofrecer) return null;

  const aceptar = () => {
    if (ocupado) return;
    setOcupado(true);
    setResultado(null);
    void activarAhora()
      .then((nuevo) => {
        cambiarEstado(nuevo);
        if (nuevo === 'activadas') setResultado('activadas');
        // Si dijo que no en la ventana del navegador, no se insiste.
        else setRespondida(true);
      })
      .catch(() => setResultado('error'))
      .finally(() => setOcupado(false));
  };

  return (
    <View style={estilos.oferta} accessibilityLiveRegion="polite">
      <Texto variante="cuerpoFuerte">{t.celular.pregunta}</Texto>
      <ComoActivarlas situacion={situacion} onHoja={setHoja} />
      {resultado === 'error' ? <Mensaje texto={t.celular.error} tipo="error" /> : null}
      <View style={estilos.botones}>
        {situacion.estado === 'ofrecer' ? (
          <Boton
            titulo={t.celular.si}
            icono="notifications-outline"
            cargando={ocupado}
            onPress={aceptar}
            style={estilos.boton}
          />
        ) : null}
        <Boton
          titulo={t.celular.ahoraNo}
          variante="fantasma"
          onPress={() => setRespondida(true)}
          style={estilos.boton}
        />
      </View>
      <HojaParaActivar hoja={hoja} app={situacion.app} onCerrar={() => setHoja(null)} />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  bloque: { gap: Espacio.s },
  oferta: {
    gap: Espacio.sm,
    padding: Espacio.m,
    borderRadius: Radio.l,
    backgroundColor: c.superficieSuave,
  },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  boton: { flexGrow: 1 },
}));

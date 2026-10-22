import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { HojaTerminos } from '@/components/legal/AceptarTerminos';
import type { EstadoContador } from '@/components/reencuentros/Contador';
import { Boton } from '@/components/ui/Boton';
import { BotonRedondo } from '@/components/ui/BotonRedondo';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { MenuOpciones } from '@/components/ui/MenuOpciones';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTerminos } from '@/features/legal/terminos';
import type { HistoriaMuro } from '@/features/reencuentros/historia';
import {
  opcionesDeHistoria,
  useDenunciaDeHistoria,
  useFamiliaOModeracion,
  useHistoria,
  useMuro,
} from '@/features/reencuentros/muro';
import { cerrarYNavegar } from '@/hooks/useCerrarConAtras';
import { useFotoPrioritaria } from '@/hooks/useFotoPrioritaria';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { linkDeHistoria } from '@/lib/compartir';
import { mensajeDeError } from '@/lib/errores';
import { elDiaDelMes } from '@/lib/fechas';
import { abrirHojaCompartir, abrirWhatsApp, copiarLink } from '@/lib/hojaCompartir';
import { urlFoto, urlMediana } from '@/lib/imagenes';
import type { AnimalDetalle } from '@/types/dominio';

/**
 * El muro de reencuentros (docs/DISENO.md, 6.19): un solo bloque aparte que
 * cargan sus dos rutas (/reencuentros y /reencuentros/<id>) y el detalle de un
 * caso reunido ("Cómo volvió"). Así nada de esto entra en la carga inicial ni
 * en __common. El muro no nombra a nadie: muestra lo que devuelven
 * muro_reencuentros e historia_reencuentro, que es lo único público.
 */

// La historia de Instagram, con su generador, en su propio bloque (el mismo que usa el caso).
const HojaHistoria = lazy(() => import('@/components/historias/HojaHistoria'));
// El contador y la denuncia también: los comparte con el mapa y con el caso.
const ConContador = lazy(() =>
  import('@/components/reencuentros/Contador').then((m) => ({ default: m.ConContador })),
);
const ModalDenuncia = lazy(() => import('@/components/reportes/ModalDenuncia'));

const formatoNumero = new Intl.NumberFormat('es-UY');

/** Cuántas tarjetas se ven al abrir sin desplazar: sus fotos se piden primero. */
const A_LA_VISTA = 1;

// --- Las acciones de una historia ----------------------------------------------

type Modal = 'opciones' | 'compartir' | 'historia' | 'denuncia' | 'cuenta' | 'terminos';

/**
 * Compartir (la hoja del sistema o, si no hay, WhatsApp y copiar el link), la
 * historia de Instagram y "Más opciones" (ver el caso, denunciar). Una sola
 * historia a la vez: las hojas son de la que se tocó.
 */
function useAccionesHistoria() {
  const router = useRouter();
  const { usuario } = useAuth();
  const terminos = useTerminos(usuario?.id);
  const [abierta, setAbierta] = useState<{ modal: Modal; historia: HistoriaMuro } | null>(null);
  const [avisoCopia, setAvisoCopia] = useState<{ texto: string; ok: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const historia = abierta?.historia ?? null;
  const denuncia = useDenunciaDeHistoria(usuario?.id, historia?.animal_id);
  // "Ver el caso" solo para la familia y moderación (opcionesDeHistoria).
  const familiaOModeracion = useFamiliaOModeracion(usuario?.id, historia?.animal_id);
  const cerrar = () => setAbierta(null);

  const mensaje = (h: HistoriaMuro) => {
    const titulo = t.reencuentros.tituloHistoria(h.nombre, h.especie);
    return {
      titulo: t.reencuentros.vistaPrevia.titulo(titulo),
      texto: t.reencuentros.compartirTexto(titulo),
      url: linkDeHistoria(h.animal_id),
    };
  };

  const compartir = async (h: HistoriaMuro) => {
    const resultado = await abrirHojaCompartir(mensaje(h));
    if (resultado === 'sinHoja') {
      setAvisoCopia(null);
      setAbierta({ modal: 'compartir', historia: h });
    }
  };

  const copiar = async (h: HistoriaMuro) => {
    const ok = await copiarLink(linkDeHistoria(h.animal_id));
    setAvisoCopia({ ok, texto: ok ? t.compartir.copiado : t.compartir.errorCopiar });
  };

  /** Denunciar pide una cuenta y los términos (la base también los exige). */
  const denunciar = (h: HistoriaMuro) => {
    if (!usuario) return setAbierta({ modal: 'cuenta', historia: h });
    if (!terminos.cargando && !terminos.aceptados)
      return setAbierta({ modal: 'terminos', historia: h });
    setAbierta({ modal: 'denuncia', historia: h });
  };

  const irA = (ruta: string) => cerrarYNavegar(cerrar, () => router.push(ruta));

  const modales: ReactNode = historia ? (
    <>
      <MenuOpciones
        visible={abierta?.modal === 'opciones'}
        titulo={t.reencuentros.opciones}
        onCerrar={cerrar}
        opciones={opcionesDeHistoria(familiaOModeracion).map((opcion) =>
          opcion === 'verCaso'
            ? {
                titulo: t.reencuentros.verCaso,
                icono: 'open-outline' as const,
                onPress: () => irA(`/animal/${historia.animal_id}`),
              }
            : {
                titulo: denuncia.yaDenuncio ? t.reencuentros.denunciada : t.reencuentros.denunciar,
                icono: 'flag-outline' as const,
                variante: 'peligro' as const,
                deshabilitado: denuncia.yaDenuncio,
                onPress: () => denunciar(historia),
              },
        )}
      />
      <MenuOpciones
        visible={abierta?.modal === 'compartir'}
        titulo={t.compartir.titulo}
        descripcion={t.compartir.intro}
        contenido={
          <View style={{ gap: Espacio.s }}>
            <Texto variante="cuerpoFuerte" selectable>
              {linkDeHistoria(historia.animal_id)}
            </Texto>
            {avisoCopia ? (
              <Mensaje texto={avisoCopia.texto} tipo={avisoCopia.ok ? 'exito' : 'error'} />
            ) : null}
          </View>
        }
        onCerrar={cerrar}
        opciones={[
          {
            titulo: t.compartir.whatsapp,
            icono: 'logo-whatsapp',
            variante: 'primario',
            onPress: () => abrirWhatsApp(mensaje(historia)),
          },
          {
            titulo: t.compartir.copiar,
            icono: 'copy-outline',
            onPress: () => void copiar(historia),
          },
        ]}
      />
      <MenuOpciones
        visible={abierta?.modal === 'cuenta'}
        titulo={t.auth.requiereCuentaTitulo}
        descripcion={t.reencuentros.requiereCuenta}
        onCerrar={cerrar}
        opciones={[
          { titulo: t.auth.ingresar, variante: 'primario', onPress: () => irA('/auth/ingresar') },
          { titulo: t.auth.registrarse, onPress: () => irA('/auth/registrarse') },
        ]}
      />
      {usuario ? (
        <>
          <HojaTerminos
            visible={abierta?.modal === 'terminos'}
            usuarioId={usuario.id}
            onCerrar={cerrar}
            onAceptado={() => setAbierta({ modal: 'denuncia', historia })}
          />
          {abierta?.modal === 'denuncia' ? (
            <Suspense fallback={null}>
              <ModalDenuncia
                visible
                animalId={historia.animal_id}
                usuarioId={usuario.id}
                historia
                onCerrar={cerrar}
                onExito={() => {
                  denuncia.refrescar();
                  cerrar();
                  setAviso(t.reencuentros.denunciaExito);
                }}
              />
            </Suspense>
          ) : null}
        </>
      ) : null}
      {abierta?.modal === 'historia' ? (
        <Suspense fallback={null}>
          <HojaHistoria de={{ tipo: 'reencuentro', historia }} onCerrar={cerrar} />
        </Suspense>
      ) : null}
    </>
  ) : null;

  return {
    aviso,
    modales,
    compartir: (h: HistoriaMuro) => void compartir(h),
    historiaDeInstagram: (h: HistoriaMuro) => setAbierta({ modal: 'historia', historia: h }),
    opciones: (h: HistoriaMuro) => setAbierta({ modal: 'opciones', historia: h }),
  };
}

type Acciones = ReturnType<typeof useAccionesHistoria>;

// --- Piezas ---------------------------------------------------------------------

/** La foto de 4:3: la mediana (la foto entera a 640) y, si no está, la original. */
function FotoReencuentro({
  ruta,
  descripcion,
  prioritaria = false,
}: {
  ruta: string;
  descripcion: string;
  prioritaria?: boolean;
}) {
  const estilos = useEstilos(crear);
  const [original, setOriginal] = useState(false);
  const cargada = useFotoPrioritaria(prioritaria, ruta);
  return (
    <Image
      source={{ uri: original ? urlFoto(ruta) : urlMediana(ruta) }}
      style={estilos.foto}
      contentFit="cover"
      priority={prioritaria ? 'high' : 'normal'}
      transition={prioritaria ? 0 : 150}
      onLoad={cargada}
      onError={() => (original ? cargada() : setOriginal(true))}
      accessible
      accessibilityLabel={descripcion}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * El contador grande: "34 animales volvieron a casa con Spot" (con menos de 5,
 * sin número). La consulta va en su propio bloque, el mismo de la tarjeta del
 * mapa; mientras llega, el lugar ya está reservado.
 */
function Contador() {
  return (
    <Suspense fallback={<BloqueContador contador={{ estado: 'cargando' }} />}>
      <ConContador>{(contador) => <BloqueContador contador={contador} />}</ConContador>
    </Suspense>
  );
}

function BloqueContador({ contador }: { contador: EstadoContador }) {
  const estilos = useEstilos(crear);
  if (contador.estado === 'error') return null;
  const numero = contador.estado === 'listo' ? contador.numero : null;
  return (
    <View
      style={estilos.contador}
      accessible
      accessibilityRole="header"
      accessibilityLabel={
        contador.estado === 'cargando'
          ? t.comunes.cargando
          : numero !== null
            ? t.reencuentros.contadorAccesible(numero)
            : t.reencuentros.contadorPrimeros
      }>
      {contador.estado === 'cargando' ? (
        <ActivityIndicator style={estilos.contadorCargando} />
      ) : numero !== null ? (
        <>
          <Texto variante="contador" color="textoPrimarioSuave">
            {formatoNumero.format(numero)}
          </Texto>
          <Texto variante="cuerpoFuerte" color="textoPrimarioSuave">
            {t.reencuentros.contadorDetalle(contador.total)}
          </Texto>
        </>
      ) : (
        <Texto variante="titulo" color="textoPrimarioSuave">
          {t.reencuentros.contadorPrimeros}
        </Texto>
      )}
    </View>
  );
}

/** Una historia: la foto, el nombre (o la especie), los días, la frase, la fecha y sus acciones. */
function TarjetaHistoria({
  historia,
  acciones,
  prioritaria = false,
  enElCaso = false,
  oculta = false,
}: {
  historia: HistoriaMuro;
  acciones: Acciones;
  prioritaria?: boolean;
  /** Oculta por moderación (o con el caso oculto): la ven la familia y moderación, sin compartir. */
  oculta?: boolean;
  /**
   * En el detalle del caso: sin el nombre (es el título de la pantalla) y sin
   * "Más opciones" (el caso ya tiene las suyas).
   */
  enElCaso?: boolean;
}) {
  const estilos = useEstilos(crear);
  const titulo = t.reencuentros.tituloHistoria(historia.nombre, historia.especie);
  return (
    <View style={estilos.tarjeta}>
      <FotoReencuentro
        ruta={historia.foto_path}
        descripcion={t.reencuentros.fotoDe(titulo)}
        prioritaria={prioritaria}
      />
      <View style={estilos.cuerpoTarjeta}>
        {enElCaso ? null : (
          <Texto variante="tituloTarjeta" accessibilityRole="header">
            {titulo}
          </Texto>
        )}
        <Texto variante="cuerpoFuerte">{t.reencuentros.dias(historia.dias)}</Texto>
        <Texto color="textoCuerpo">{historia.frase}</Texto>
        <Texto variante="pequeno">{t.reencuentros.fecha(elDiaDelMes(historia.reunido_en))}</Texto>
      </View>
      <View style={estilos.accionesTarjeta}>
        {oculta ? null : (
          <BotonRedondo
            icono="share-social-outline"
            accessibilityLabel={t.compartir.boton}
            flotante={false}
            onPress={() => acciones.compartir(historia)}
          />
        )}
        {Platform.OS === 'web' && !oculta ? (
          <BotonRedondo
            icono="logo-instagram"
            accessibilityLabel={t.historia.boton}
            flotante={false}
            onPress={() => acciones.historiaDeInstagram(historia)}
          />
        ) : null}
        {enElCaso ? null : (
          <BotonRedondo
            icono="ellipsis-horizontal"
            accessibilityLabel={t.reencuentros.opciones}
            flotante={false}
            onPress={() => acciones.opciones(historia)}
          />
        )}
      </View>
    </View>
  );
}

// --- Pantallas --------------------------------------------------------------------

/** /reencuentros: el contador y las historias más recientes, de a 20. */
export function MuroReencuentros() {
  const estilos = useEstilos(crear);
  const muro = useMuro();
  const acciones = useAccionesHistoria();
  const historias = muro.data?.pages.flat() ?? [];

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.lista}>
      <Texto variante="secundario">{t.reencuentros.intro}</Texto>
      <Contador />
      {acciones.aviso ? <Mensaje texto={acciones.aviso} tipo="exito" /> : null}
      {muro.isPending ? (
        <Cargando />
      ) : muro.isError ? (
        <Mensaje
          texto={mensajeDeError(muro.error)}
          tipo="error"
          onReintentar={() => void muro.refetch()}
        />
      ) : historias.length === 0 ? (
        <Texto variante="secundario">{t.reencuentros.vacio}</Texto>
      ) : (
        <View style={estilos.lista}>
          {historias.map((h, i) => (
            <TarjetaHistoria
              key={h.animal_id}
              historia={h}
              acciones={acciones}
              prioritaria={i < A_LA_VISTA}
            />
          ))}
          {muro.hasNextPage ? (
            <Boton
              titulo={t.reencuentros.verMas}
              variante="fantasma"
              cargando={muro.isFetchingNextPage}
              onPress={() => void muro.fetchNextPage()}
            />
          ) : null}
        </View>
      )}
      {acciones.modales}
    </Pantalla>
  );
}

/** /reencuentros/<id>: la historia que llegó por un link, y el muro entero a un toque. */
export function PantallaHistoria({ id }: { id: string }) {
  const router = useRouter();
  const historia = useHistoria(id);
  const acciones = useAccionesHistoria();

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.lista}>
      {historia.isPending ? (
        <Cargando />
      ) : historia.isError ? (
        <Mensaje
          texto={mensajeDeError(historia.error)}
          tipo="error"
          onReintentar={() => void historia.refetch()}
        />
      ) : !historia.data ? (
        <Mensaje texto={t.reencuentros.noDisponible} />
      ) : (
        <>
          {historia.data.oculta ? <Mensaje texto={t.reencuentros.oculta} tipo="error" /> : null}
          {acciones.aviso ? <Mensaje texto={acciones.aviso} tipo="exito" /> : null}
          <TarjetaHistoria
            historia={historia.data}
            acciones={acciones}
            prioritaria
            oculta={historia.data.oculta}
          />
        </>
      )}
      <Boton
        titulo={t.reencuentros.verTodas}
        icono="heart-outline"
        variante="secundario"
        onPress={() => router.push('/reencuentros')}
      />
      {acciones.modales}
    </Pantalla>
  );
}

/**
 * "Cómo volvió", en el detalle de un caso reunido: la historia, si hay. A la
 * familia, además, "Contar cómo volvió" o "Editar la historia".
 */
export function HistoriaEnElCaso({ animal }: { animal: AnimalDetalle }) {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const { usuario } = useAuth();
  const historia = useHistoria(animal.id);
  const acciones = useAccionesHistoria();
  const esFamilia =
    !!usuario && animal.tipo_reporte === 'perdido' && animal.creado_por === usuario.id;
  const contar = () =>
    router.push({ pathname: '/animal/[id]/reencuentro', params: { id: animal.id } });

  if (historia.isPending || historia.isError) return null;
  if (!historia.data) {
    if (!esFamilia || animal.oculto) return null;
    return (
      <View style={estilos.invitacion}>
        <Texto variante="tituloTarjeta">{t.reencuentros.enElCaso.pregunta}</Texto>
        <Texto variante="secundario">{t.reencuentros.enElCaso.ayuda}</Texto>
        <Boton titulo={t.reencuentros.enElCaso.contar} icono="heart-outline" onPress={contar} />
      </View>
    );
  }
  return (
    <View style={estilos.seccion}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {t.reencuentros.enElCaso.titulo}
      </Texto>
      {historia.data.oculta ? <Mensaje texto={t.reencuentros.oculta} tipo="error" /> : null}
      <TarjetaHistoria
        historia={historia.data}
        acciones={acciones}
        enElCaso
        oculta={historia.data.oculta}
      />
      {esFamilia ? (
        <Boton
          titulo={t.reencuentros.enElCaso.editar}
          icono="create-outline"
          variante="secundario"
          onPress={contar}
        />
      ) : null}
      <Boton
        titulo={t.reencuentros.verTodas}
        icono="heart-outline"
        variante="fantasma"
        onPress={() => router.push('/reencuentros')}
      />
      {acciones.modales}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  contador: {
    gap: Espacio.xs,
    minHeight: 120,
    justifyContent: 'center',
    padding: Espacio.ml,
    borderRadius: Radio.xl,
    backgroundColor: c.primarioSuave,
  },
  contadorCargando: { alignSelf: 'flex-start' },
  lista: { gap: Espacio.m },
  tarjeta: {
    overflow: 'hidden',
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  // La foto nunca se oscurece ni se filtra, tampoco en modo oscuro.
  foto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: c.superficieSuave },
  cuerpoTarjeta: { gap: Espacio.xs, paddingHorizontal: Espacio.m, paddingTop: Espacio.m },
  accionesTarjeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Espacio.s,
    padding: Espacio.s,
  },
  seccion: { gap: Espacio.m },
  invitacion: {
    gap: Espacio.s,
    padding: Espacio.m,
    borderRadius: Radio.l,
    backgroundColor: c.superficieSuave,
  },
}));

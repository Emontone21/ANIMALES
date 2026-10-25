import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { BotonGoogleRespaldo } from '@/components/auth/BotonGoogleRespaldo';
import type { PropsIngresoGoogle } from '@/components/auth/IngresoGoogle';
import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import {
  type EstadoScriptGoogle,
  formaDeIngresarConGoogle,
  ingresarConTokenDeGoogle,
  prepararNonce,
} from '@/features/auth/google';
import { cargarGoogle, type IdentidadGoogle } from '@/features/auth/scriptGoogle';
import { appConNavegador } from '@/features/instalar/formaDeInstalar';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';
import { mensajeDeError } from '@/lib/errores';
import { copiarLink } from '@/lib/hojaCompartir';

export type { PropsIngresoGoogle } from '@/components/auth/IngresoGoogle';

/** El botón grande de Google mide 40 de alto: así no salta la pantalla cuando aparece. */
const ALTO_BOTON = 40;
/** Google acepta un ancho de 200 a 400. */
const ANCHO_MINIMO = 200;
const ANCHO_MAXIMO = 400;

/**
 * "Continuar con Google" en web (docs/DISENO.md, 7.7): el botón oficial de
 * Google Identity Services, que dibuja Google en su idioma y con su diseño. Al
 * elegir la cuenta, Google devuelve un token y la app abre la sesión con
 * signInWithIdToken (features/auth/google.ts). En el navegador de WhatsApp,
 * Instagram o Facebook explica cómo abrir el link en Chrome o Safari. Si el
 * script no carga o falla, el botón de siempre.
 */
export default function IngresoGoogle({ deshabilitado = false }: PropsIngresoGoogle) {
  const { c, esquema } = useTema();
  const estilos = useEstilos(crear);
  const contenedor = useRef<ComponentRef<typeof View>>(null);
  const google = useRef<IdentidadGoogle | null>(null);
  const [script, setScript] = useState<EstadoScriptGoogle>('cargando');
  const [ancho, setAncho] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const forma = formaDeIngresarConGoogle({
    plataforma: Platform.OS,
    userAgent,
    clientId: ENV.googleClientId,
    script,
  });
  const usaBoton = forma === 'boton' || forma === 'cargando';

  // El script y el nonce, una vez por pantalla. Google pone el hash del nonce
  // en el token; Supabase recibe el original.
  useEffect(() => {
    const clientId = ENV.googleClientId;
    if (!usaBoton || !clientId) return;
    let vigente = true;
    Promise.all([cargarGoogle(), prepararNonce()])
      .then(([identidad, nonce]) => {
        if (!vigente) return;
        identidad.initialize({
          client_id: clientId,
          nonce: nonce.hash,
          use_fedcm_for_prompt: true,
          callback: ({ credential }) => {
            setCargando(true);
            setError(null);
            ingresarConTokenDeGoogle(credential, nonce)
              .catch((e: unknown) => setError(mensajeDeError(e, t.auth.errores.desconocido)))
              .finally(() => setCargando(false));
          },
        });
        google.current = identidad;
        setScript('listo');
      })
      .catch(() => {
        if (vigente) setScript('fallo');
      });
    return () => {
      vigente = false;
    };
    // Una sola vez: la forma no cambia mientras la pantalla está abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El botón, en el cuadro siguiente al layout, y de nuevo si cambia el ancho
  // o el modo oscuro. Si Google falla al dibujarlo, el botón de siempre.
  useEffect(() => {
    // En web, la referencia de un View es su elemento del DOM.
    const elemento = contenedor.current as unknown as HTMLElement | null;
    const identidad = google.current;
    if (forma !== 'boton' || !ancho || !elemento || !identidad) return;
    const cuadro = requestAnimationFrame(() => {
      try {
        elemento.replaceChildren();
        identidad.renderButton(elemento, {
          type: 'standard',
          theme: esquema === 'oscuro' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          locale: 'es-419',
          width: Math.round(Math.max(ANCHO_MINIMO, Math.min(ancho, ANCHO_MAXIMO))),
        });
      } catch {
        setScript('fallo');
      }
    });
    return () => cancelAnimationFrame(cuadro);
  }, [forma, ancho, esquema]);

  if (forma === 'abrirEnNavegador') {
    return <AbrirEnNavegador app={appConNavegador(userAgent) ?? ''} />;
  }
  if (forma === 'respaldo') return <BotonGoogleRespaldo deshabilitado={deshabilitado} />;

  const bloqueado = deshabilitado || cargando;
  return (
    <View style={estilos.bloque}>
      {error ? <Mensaje texto={error} tipo="error" /> : null}
      <View
        onLayout={(evento) => setAncho(evento.nativeEvent.layout.width)}
        style={[estilos.lugar, bloqueado && estilos.bloqueado]}
        aria-busy={forma === 'cargando' || cargando}>
        <View ref={contenedor} style={estilos.boton} />
        {cargando ? <ActivityIndicator color={c.primario} style={estilos.indicador} /> : null}
      </View>
    </View>
  );
}

/** El navegador de WhatsApp, Instagram o Facebook: abrir el link en Chrome o Safari. */
function AbrirEnNavegador({ app }: { app: string }) {
  const estilos = useEstilos(crear);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  // El link de esta pantalla: en Chrome o Safari abre Ingresar o Registrarse.
  const link = window.location.href;

  const copiar = async () => {
    const ok = await copiarLink(link);
    setAviso({ ok, texto: ok ? t.compartir.copiado : t.compartir.errorCopiar });
  };

  return (
    <View style={estilos.bloque}>
      <Mensaje texto={t.auth.google.navegadorInterno(app)} />
      {/* A la vista, por si no se puede copiar ("Seleccionalo arriba y copialo"). */}
      <Texto variante="cuerpoFuerte" selectable style={estilos.link}>
        {link}
      </Texto>
      <Boton
        titulo={t.compartir.copiar}
        icono="copy-outline"
        variante="secundario"
        onPress={() => void copiar()}
      />
      {aviso ? <Mensaje texto={aviso.texto} tipo={aviso.ok ? 'exito' : 'error'} /> : null}
    </View>
  );
}

const crear = crearEstilos(() => ({
  bloque: { gap: Espacio.m },
  link: { textAlign: 'center' },
  lugar: { minHeight: ALTO_BOTON, alignItems: 'center', justifyContent: 'center' },
  boton: { minHeight: ALTO_BOTON, alignItems: 'center' },
  // Mientras se ingresa (con email o con Google), el botón de Google no se toca.
  bloqueado: { opacity: 0.5, pointerEvents: 'none' },
  indicador: { position: 'absolute' },
}));

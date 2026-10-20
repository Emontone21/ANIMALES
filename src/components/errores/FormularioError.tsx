import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Hoja } from '@/components/ui/Hoja';
import { Mensaje } from '@/components/ui/Mensaje';
import { Seccion } from '@/components/ui/Seccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Fuentes, Radio } from '@/constants/tema';
import { useReportarError } from '@/features/errores/api';
import {
  datosDelDispositivo,
  LIMITES_REPORTE,
  validarReporte,
  versionDeLaApp,
} from '@/features/errores/reporte';
import { type FotoElegida, useElegirFoto } from '@/hooks/useElegirFoto';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { pantallaAnterior } from '@/lib/rutasRecientes';

type Props = {
  /** Con cuenta: captura opcional y respuesta en Actividad. Sin cuenta: contacto opcional. */
  usuarioId: string | null;
  onCerrar: () => void;
  onExito: () => void;
};

/**
 * "Reportar un error" (Perfil): qué pasó, qué estaba haciendo y una captura o
 * un contacto. La app suma la pantalla anterior, el navegador y el sistema, el
 * tamaño de pantalla, la plataforma y la versión, y se los muestra antes de
 * mandar. Va en un bloque aparte, que Perfil carga al tocar el botón.
 */
export default function FormularioError({ usuarioId, onCerrar, onExito }: Props) {
  const estilos = useEstilos(crear);
  const conCuenta = usuarioId !== null;
  const reportar = useReportarError(usuarioId);
  const [quePaso, setQuePaso] = useState('');
  const [queHacias, setQueHacias] = useState('');
  const [contacto, setContacto] = useState('');
  const [captura, setCaptura] = useState<FotoElegida | null>(null);
  const [intentado, setIntentado] = useState(false);
  const { aviso, elegirDeGaleria } = useElegirFoto(setCaptura);
  const { width, height, scale } = useWindowDimensions();

  const dispositivo = useMemo(
    () =>
      datosDelDispositivo({
        pantallaAnterior: pantallaAnterior(),
        userAgent:
          Platform.OS === 'web'
            ? navigator.userAgent
            : `${Platform.OS} ${String(Platform.Version)}`,
        ancho: width,
        alto: height,
        escala: scale,
        plataforma: Platform.OS,
        // Las pone el build (vercel.json): el commit del deploy o, si no, la fecha.
        version: versionDeLaApp(
          Constants.expoConfig?.version ?? '0.0.0',
          process.env.EXPO_PUBLIC_COMMIT,
          process.env.EXPO_PUBLIC_FECHA_BUILD,
        ),
      }),
    [width, height, scale],
  );

  const errores = validarReporte({ quePaso, queHacias, contacto }, conCuenta);
  const mostrar = (campo: keyof typeof errores) => (intentado ? (errores[campo] ?? null) : null);

  const enviar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    reportar.mutate(
      { quePaso, queHacias, contacto, captura: conCuenta ? captura : null, dispositivo },
      { onSuccess: onExito },
    );
  };

  const datos: [string, string][] = [
    [
      t.errores.datos.pantallaAnterior,
      dispositivo.pantallaAnterior ?? t.errores.formulario.ninguna,
    ],
    [t.errores.datos.navegador, dispositivo.navegador ?? '—'],
    [t.errores.datos.tamanioPantalla, dispositivo.tamanioPantalla],
    [t.errores.datos.version, dispositivo.version],
  ];

  return (
    <Hoja
      visible
      titulo={t.errores.formulario.titulo}
      intro={t.errores.formulario.intro}
      onCerrar={onCerrar}
      pie={
        <Boton
          titulo={t.errores.formulario.enviar}
          icono="send-outline"
          cargando={reportar.isPending}
          onPress={enviar}
        />
      }>
      <CampoTexto
        etiqueta={t.errores.formulario.quePaso}
        placeholder={t.errores.formulario.quePasoPlaceholder}
        value={quePaso}
        onChangeText={setQuePaso}
        multiline
        maxLength={LIMITES_REPORTE.quePasoMaximo}
        error={mostrar('quePaso')}
        aria-required
      />
      <CampoTexto
        etiqueta={t.errores.formulario.queHacias}
        placeholder={t.errores.formulario.queHaciasPlaceholder}
        value={queHacias}
        onChangeText={setQueHacias}
        multiline
        maxLength={LIMITES_REPORTE.queHaciasMaximo}
        error={mostrar('queHacias')}
      />

      {conCuenta ? (
        <Seccion titulo={t.errores.formulario.captura}>
          {captura ? (
            <Image
              source={{ uri: captura.uri }}
              accessibilityLabel={t.errores.formulario.captura}
              style={estilos.captura}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <View style={estilos.botones}>
            <Boton
              titulo={
                captura ? t.errores.formulario.cambiarCaptura : t.errores.formulario.elegirCaptura
              }
              icono="image-outline"
              variante="secundario"
              onPress={() => void elegirDeGaleria()}
              style={estilos.boton}
            />
            {captura ? (
              <Boton
                titulo={t.errores.formulario.quitarCaptura}
                icono="close-outline"
                variante="fantasma"
                onPress={() => setCaptura(null)}
                style={estilos.boton}
              />
            ) : null}
          </View>
          {aviso ? <Mensaje texto={aviso} /> : null}
        </Seccion>
      ) : (
        <CampoTexto
          etiqueta={t.errores.formulario.contacto}
          placeholder={t.errores.formulario.contactoPlaceholder}
          ayuda={t.errores.formulario.contactoAyuda}
          value={contacto}
          onChangeText={setContacto}
          maxLength={LIMITES_REPORTE.contactoMaximo}
          autoCapitalize="none"
          error={mostrar('contacto')}
        />
      )}

      <View style={estilos.datos}>
        <Texto variante="secundario">{t.errores.formulario.seSuma}</Texto>
        {datos.map(([etiqueta, valor]) => (
          <Texto key={etiqueta} variante="pequeno" numberOfLines={2}>
            <Texto variante="pequeno" color="texto" style={estilos.etiqueta}>
              {etiqueta}:
            </Texto>{' '}
            {valor}
          </Texto>
        ))}
      </View>

      {reportar.isError ? <Mensaje texto={mensajeDeError(reportar.error)} tipo="error" /> : null}
    </Hoja>
  );
}

const crear = crearEstilos((c) => ({
  captura: {
    width: '100%',
    height: 220,
    borderRadius: Radio.m,
    backgroundColor: c.superficieSuave,
  },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  boton: { flex: 1, minWidth: 180 },
  datos: {
    gap: Espacio.xs,
    padding: Espacio.m,
    borderRadius: Radio.l,
    backgroundColor: c.superficieSuave,
  },
  etiqueta: { ...Fuentes.negrita },
}));

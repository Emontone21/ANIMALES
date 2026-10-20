import { useIsFocused } from 'expo-router';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { useEstadoReconocimiento, useProcesarPendientes } from '@/features/reconocimiento/api';
import { avisoProcesar, cuando } from '@/features/reconocimiento/estado';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/**
 * Panel de moderación › Reconocimiento: si el servicio de visión está
 * configurado, cómo está la cola y cuándo anduvo por última vez, y el botón
 * que hace la misma llamada que el trabajo de cada 2 minutos. Sin la URL ni el
 * secreto. Va en un bloque aparte: el panel lo carga al elegir Reconocimiento.
 */
export default function ReconocimientoModeracion() {
  const estilos = useEstilos(crear);
  const enFoco = useIsFocused();
  const estado = useEstadoReconocimiento(enFoco);
  const procesar = useProcesarPendientes();

  if (estado.isPending) return <Cargando />;
  if (estado.isError) {
    return (
      <Mensaje
        texto={mensajeDeError(estado.error)}
        tipo="error"
        onReintentar={() => void estado.refetch()}
      />
    );
  }

  const e = estado.data;
  const aviso = procesar.data ? avisoProcesar(procesar.data) : null;

  return (
    <View style={estilos.raiz}>
      <Texto variante="secundario">{t.reconocimiento.intro}</Texto>
      <View style={estilos.tarjeta}>
        <Dato etiqueta={t.reconocimiento.estado}>
          <Etiqueta
            texto={e.configurado ? t.reconocimiento.configurado : t.reconocimiento.sinConfigurar}
            fondo={e.configurado ? 'primarioSuave' : 'avisoFondo'}
            color={e.configurado ? 'textoPrimarioSuave' : 'texto'}
          />
        </Dato>
        <Dato etiqueta={t.reconocimiento.pendientes}>
          <Texto variante="cuerpoFuerte">{e.pendientes}</Texto>
          {e.reintentando > 0 ? (
            <Texto variante="pequeno">{t.reconocimiento.reintentando(e.reintentando)}</Texto>
          ) : null}
        </Dato>
        <Dato etiqueta={t.reconocimiento.conError}>
          <Texto variante="cuerpoFuerte" color={e.con_error > 0 ? 'peligro' : 'texto'}>
            {e.con_error}
          </Texto>
          {e.con_error > 0 ? (
            <Texto variante="pequeno">{t.reconocimiento.conErrorAyuda}</Texto>
          ) : null}
        </Dato>
        <Dato etiqueta={t.reconocimiento.ultimaProcesada}>
          <Texto variante="cuerpoFuerte">{cuando(e.ultima_procesada)}</Texto>
        </Dato>
        <Dato etiqueta={t.reconocimiento.ultimaCoincidencia}>
          <Texto variante="cuerpoFuerte">{cuando(e.ultima_coincidencia)}</Texto>
        </Dato>
      </View>
      {!e.configurado ? <Mensaje texto={t.reconocimiento.sinConfigurarAyuda} /> : null}
      <Boton
        titulo={t.reconocimiento.procesar}
        variante="secundario"
        icono="refresh-outline"
        cargando={procesar.isPending}
        deshabilitado={!e.configurado}
        onPress={() => procesar.mutate()}
      />
      {procesar.isError ? (
        <Mensaje texto={mensajeDeError(procesar.error)} tipo="error" />
      ) : aviso ? (
        <Mensaje texto={aviso.texto} tipo={aviso.tipo} />
      ) : null}
    </View>
  );
}

/** Un dato de la tarjeta: el nombre en secundario y, debajo, su valor. */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.dato}>
      <Texto variante="secundario">{etiqueta}</Texto>
      <View style={estilos.valor}>{children}</View>
    </View>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { gap: Espacio.m },
  tarjeta: {
    gap: Espacio.m,
    padding: Espacio.m,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  dato: { gap: Espacio.xs },
  valor: { gap: 2, alignItems: 'flex-start' },
}));

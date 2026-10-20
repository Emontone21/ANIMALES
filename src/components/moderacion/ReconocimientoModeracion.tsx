import { useIsFocused } from 'expo-router';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import {
  useErroresIa,
  useEstadoReconocimiento,
  useProcesarPendientes,
  useReactivarReconocimiento,
} from '@/features/reconocimiento/api';
import {
  avisoProcesar,
  avisoReactivar,
  cuando,
  enElTope,
  estadoGeneral,
  etiquetaEstado,
  filaError,
  puedeProcesar,
} from '@/features/reconocimiento/estado';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/**
 * Panel de moderación › Reconocimiento: si el reconocimiento con IA está
 * configurado, prendido o pausado por falta de crédito; cómo está la cola;
 * las llamadas de hoy, el costo del mes y los errores de la API; "Reactivar"
 * y el botón que hace la misma llamada que el trabajo de cada 2 minutos. Sin
 * la URL ni el secreto. Va en un bloque aparte: el panel lo carga al elegir
 * Reconocimiento.
 */
export default function ReconocimientoModeracion() {
  const estilos = useEstilos(crear);
  const enFoco = useIsFocused();
  const estado = useEstadoReconocimiento(enFoco);
  const errores = useErroresIa(enFoco);
  const procesar = useProcesarPendientes();
  const reactivar = useReactivarReconocimiento();

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
  const general = estadoGeneral(e);
  const etiqueta = etiquetaEstado(general);
  const aviso = procesar.data ? avisoProcesar(procesar.data) : null;
  const avisoReactivado = reactivar.data ? avisoReactivar(reactivar.data) : null;
  const ultimosErrores = errores.data ?? [];

  return (
    <View style={estilos.raiz}>
      <Texto variante="secundario">{t.reconocimiento.intro}</Texto>
      <View style={estilos.tarjeta}>
        <Dato etiqueta={t.reconocimiento.estado}>
          <Etiqueta texto={etiqueta.texto} fondo={etiqueta.fondo} color={etiqueta.color} />
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
        <Dato etiqueta={t.reconocimiento.llamadasHoy}>
          <Texto variante="cuerpoFuerte">
            {t.reconocimiento.deTope(e.llamadas_hoy, e.tope_diario)}
          </Texto>
          {enElTope(e) ? <Texto variante="pequeno">{t.reconocimiento.topeAlcanzado}</Texto> : null}
        </Dato>
        <Dato etiqueta={t.reconocimiento.costoMes}>
          <Texto variante="cuerpoFuerte">{t.reconocimiento.costo(Number(e.costo_mes))}</Texto>
          <Texto variante="pequeno">{t.reconocimiento.costoAyuda}</Texto>
        </Dato>
        <Dato etiqueta={t.reconocimiento.erroresIa}>
          <Texto variante="cuerpoFuerte" color={e.errores_hoy > 0 ? 'peligro' : 'texto'}>
            {t.reconocimiento.erroresHoy(e.errores_hoy)}
          </Texto>
          {ultimosErrores.length === 0 ? (
            <Texto variante="pequeno">{t.reconocimiento.sinErrores}</Texto>
          ) : (
            ultimosErrores.map((llamada) => (
              <Texto key={llamada.id} variante="pequeno">
                {filaError(llamada)}
              </Texto>
            ))
          )}
        </Dato>
        <Dato etiqueta={t.reconocimiento.ultimaProcesada}>
          <Texto variante="cuerpoFuerte">{cuando(e.ultima_procesada)}</Texto>
        </Dato>
        <Dato etiqueta={t.reconocimiento.ultimaCoincidencia}>
          <Texto variante="cuerpoFuerte">{cuando(e.ultima_coincidencia)}</Texto>
        </Dato>
      </View>
      {etiqueta.ayuda ? <Mensaje texto={etiqueta.ayuda} /> : null}
      {general === 'pausado' ? (
        <Boton
          titulo={t.reconocimiento.reactivar}
          icono="play-outline"
          cargando={reactivar.isPending}
          onPress={() => reactivar.mutate()}
        />
      ) : null}
      {reactivar.isError ? (
        <Mensaje texto={mensajeDeError(reactivar.error)} tipo="error" />
      ) : avisoReactivado ? (
        <Mensaje texto={avisoReactivado.texto} tipo={avisoReactivado.tipo} />
      ) : null}
      <Boton
        titulo={t.reconocimiento.procesar}
        variante="secundario"
        icono="refresh-outline"
        cargando={procesar.isPending}
        deshabilitado={!puedeProcesar(e)}
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

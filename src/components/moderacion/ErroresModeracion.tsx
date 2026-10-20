import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Cargando } from '@/components/ui/Cargando';
import { Chips } from '@/components/ui/Chips';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Fuentes, Radio } from '@/constants/tema';
import {
  useReportesErrores,
  useResolverReporteError,
  useUrlCaptura,
} from '@/features/errores/moderacion';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { fechaHoraCorta } from '@/lib/fechas';
import type { Plataforma, ReporteErrorDetalle } from '@/types/dominio';

type Filtro = 'pendientes' | 'resueltos';

/**
 * Panel de moderación › Errores: los reportes pendientes y los resueltos, con
 * todo lo que mandó la persona y lo que sumó la app. "Marcar como resuelto"
 * acepta una nota, que le llega en Actividad a quien lo mandó con su cuenta.
 * Va en un bloque aparte: el panel lo carga al elegir Errores.
 */
export default function ErroresModeracion() {
  const estilos = useEstilos(crear);
  const reportes = useReportesErrores(true);
  const [filtro, setFiltro] = useState<Filtro>('pendientes');

  if (reportes.isPending) return <Cargando />;
  if (reportes.isError) {
    return (
      <Mensaje
        texto={mensajeDeError(reportes.error)}
        tipo="error"
        onReintentar={() => void reportes.refetch()}
      />
    );
  }

  const pendientes = reportes.data.filter((r) => !r.resuelto_en);
  const resueltos = reportes.data.filter((r) => r.resuelto_en);
  const lista = filtro === 'pendientes' ? pendientes : resueltos;

  return (
    <View style={estilos.raiz}>
      <Chips
        opciones={[
          {
            valor: 'pendientes',
            etiqueta: `${t.errores.moderacion.pendientes} (${pendientes.length})`,
          },
          {
            valor: 'resueltos',
            etiqueta: `${t.errores.moderacion.resueltos} (${resueltos.length})`,
          },
        ]}
        valor={filtro}
        onCambio={setFiltro}
        accessibilityLabel={t.errores.moderacion.errores}
      />
      {lista.length === 0 ? (
        <Texto variante="secundario">
          {filtro === 'pendientes'
            ? t.errores.moderacion.sinPendientes
            : t.errores.moderacion.sinResueltos}
        </Texto>
      ) : (
        <View style={estilos.filas}>
          {lista.map((r) => (
            <TarjetaError key={r.id} reporte={r} />
          ))}
        </View>
      )}
    </View>
  );
}

function TarjetaError({ reporte: r }: { reporte: ReporteErrorDetalle }) {
  const estilos = useEstilos(crear);
  const resolver = useResolverReporteError();
  const [nota, setNota] = useState('');
  const [verCaptura, setVerCaptura] = useState(false);
  const captura = useUrlCaptura(verCaptura ? r.captura_path : null);

  const quien =
    r.usuario_nombre ?? (r.sin_cuenta ? t.errores.moderacion.sinCuenta : t.comunes.cuentaEliminada);
  const datos: [string, string | null][] = [
    [t.errores.moderacion.queHacias, r.que_hacias],
    [t.errores.moderacion.contacto, r.contacto],
    [t.errores.datos.pantallaAnterior, r.pantalla_anterior],
    [t.errores.datos.navegador, r.navegador],
    [t.errores.datos.tamanioPantalla, r.tamanio_pantalla],
    [
      t.errores.datos.plataforma,
      r.plataforma ? (t.errores.plataforma[r.plataforma as Plataforma] ?? r.plataforma) : null,
    ],
    [t.errores.datos.version, r.version_app],
  ];

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.fila}>
        <Etiqueta
          texto={
            r.resuelto_en ? t.errores.moderacion.resueltoEtiqueta : t.errores.moderacion.pendiente
          }
          fondo={r.resuelto_en ? 'superficieSuave' : 'avisoFondo'}
          color={r.resuelto_en ? 'textoSecundario' : 'texto'}
        />
        {r.sin_cuenta ? (
          <Etiqueta
            texto={t.errores.moderacion.sinCuenta}
            fondo="superficieSuave"
            color="textoSecundario"
          />
        ) : null}
      </View>
      <Texto variante="pequeno">
        {quien} · {fechaHoraCorta(r.created_at)}
      </Texto>
      <Texto selectable>{r.que_paso}</Texto>

      <View style={estilos.datos}>
        {datos.map(([etiqueta, valor]) =>
          valor ? (
            <Texto key={etiqueta} variante="pequeno" selectable>
              <Texto variante="pequeno" color="texto" style={estilos.etiqueta}>
                {etiqueta}:
              </Texto>{' '}
              {valor}
            </Texto>
          ) : null,
        )}
      </View>

      {r.captura_path ? (
        verCaptura ? (
          captura.isError ? (
            <Mensaje texto={t.errores.moderacion.errorCaptura} tipo="error" />
          ) : captura.data ? (
            <Image
              source={{ uri: captura.data }}
              accessibilityLabel={t.errores.moderacion.captura}
              style={estilos.captura}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Cargando />
          )
        ) : (
          <Boton
            titulo={t.errores.moderacion.verCaptura}
            icono="image-outline"
            variante="fantasma"
            onPress={() => setVerCaptura(true)}
            style={estilos.botonChico}
          />
        )
      ) : null}

      {r.resuelto_en ? (
        <View style={estilos.resolucion}>
          <Texto variante="pequeno">
            {t.errores.moderacion.resuelto(
              r.resuelto_por_nombre ?? t.comunes.cuentaEliminada,
              fechaHoraCorta(r.resuelto_en),
            )}
          </Texto>
          {r.nota_resolucion ? (
            <Texto variante="secundario">
              {t.errores.moderacion.notaGuardada}: {r.nota_resolucion}
            </Texto>
          ) : null}
        </View>
      ) : (
        <View style={estilos.resolucion}>
          <CampoTexto
            etiqueta={t.errores.moderacion.nota}
            ayuda={r.usuario_id ? t.errores.moderacion.notaAyuda : undefined}
            value={nota}
            onChangeText={setNota}
            multiline
            maxLength={1000}
          />
          {resolver.isError ? (
            <Mensaje texto={mensajeDeError(resolver.error)} tipo="error" />
          ) : null}
          <Boton
            titulo={t.errores.moderacion.marcarResuelto}
            icono="checkmark-outline"
            cargando={resolver.isPending}
            onPress={() => resolver.mutate({ id: r.id, nota })}
          />
        </View>
      )}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { gap: Espacio.m },
  filas: { borderTopWidth: 1, borderTopColor: c.borde },
  tarjeta: {
    gap: Espacio.sm,
    paddingVertical: Espacio.m,
    paddingHorizontal: Espacio.s,
    borderBottomWidth: 1,
    borderBottomColor: c.borde,
  },
  fila: { flexDirection: 'row', gap: Espacio.s, flexWrap: 'wrap' },
  datos: {
    gap: Espacio.xs,
    padding: Espacio.sm,
    borderRadius: Radio.l,
    backgroundColor: c.superficieSuave,
  },
  etiqueta: { ...Fuentes.negrita },
  captura: {
    width: '100%',
    height: 320,
    borderRadius: Radio.m,
    backgroundColor: c.superficieSuave,
  },
  botonChico: { alignSelf: 'flex-start' },
  resolucion: { gap: Espacio.sm },
}));

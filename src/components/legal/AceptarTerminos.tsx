import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { EnlacesLegales } from '@/components/legal/EnlacesLegales';
import { Boton } from '@/components/ui/Boton';
import { Casilla } from '@/components/ui/Casilla';
import { Hoja } from '@/components/ui/Hoja';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { useTerminos } from '@/features/legal/terminos';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

type Props = {
  usuarioId: string;
  onAceptado?: () => void;
  /** Dentro de un modal: lo cierra antes de ir a leer los textos. */
  onAntesDeNavegar?: () => void;
  /** Sin borde ni fondo propios, cuando ya va dentro de una hoja. */
  sinMarco?: boolean;
};

/**
 * Para quien entró con Google o aceptó una versión anterior: lee los textos,
 * marca la casilla y acepta, antes de publicar, escribir o denunciar.
 */
export function AceptarTerminos({ usuarioId, onAceptado, onAntesDeNavegar, sinMarco }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const terminos = useTerminos(usuarioId);
  const [marcado, setMarcado] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const aceptar = () => {
    setIntentado(true);
    if (!marcado) return;
    terminos.aceptar.mutate(undefined, { onSuccess: () => onAceptado?.() });
  };

  return (
    <View style={sinMarco ? estilos.sinMarco : estilos.tarjeta}>
      {/* En una hoja, el título ya está en su encabezado. */}
      {sinMarco ? null : (
        <>
          <View style={estilos.icono}>
            <Ionicons name="document-text-outline" size={26} color={c.textoPrimarioSuave} />
          </View>
          <Texto variante="subtitulo" accessibilityRole="header">
            {t.legal.aceptar.titulo}
          </Texto>
        </>
      )}
      <Texto color="textoCuerpo">
        {terminos.cambiaron ? t.legal.aceptar.cambiaron : t.legal.aceptar.intro}
      </Texto>
      <EnlacesLegales onAntesDeNavegar={onAntesDeNavegar} />
      <Casilla
        etiqueta={t.auth.aceptoTerminos}
        valor={marcado}
        onCambio={setMarcado}
        error={intentado && !marcado ? t.legal.aceptar.falta : null}
      />
      {terminos.aceptar.isError ? (
        <Mensaje texto={mensajeDeError(terminos.aceptar.error)} tipo="error" />
      ) : null}
      <Boton
        titulo={t.legal.aceptar.aceptar}
        icono="checkmark-outline"
        cargando={terminos.aceptar.isPending}
        onPress={aceptar}
      />
    </View>
  );
}

/** La misma aceptación en un modal, para las acciones del detalle y la conversación. */
export function HojaTerminos({
  visible,
  usuarioId,
  onCerrar,
  onAceptado,
}: {
  visible: boolean;
  usuarioId: string;
  onCerrar: () => void;
  onAceptado: () => void;
}) {
  return (
    <Hoja visible={visible} titulo={t.legal.aceptar.titulo} onCerrar={onCerrar}>
      <AceptarTerminos
        usuarioId={usuarioId}
        onAceptado={onAceptado}
        onAntesDeNavegar={onCerrar}
        sinMarco
      />
    </Hoja>
  );
}

const crear = crearEstilos((c) => ({
  tarjeta: {
    gap: Espacio.m,
    padding: Espacio.ml,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  sinMarco: { gap: Espacio.m },
  icono: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: c.primarioSuave,
  },
}));

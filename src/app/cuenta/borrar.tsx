import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Casilla } from '@/components/ui/Casilla';
import { Mensaje } from '@/components/ui/Mensaje';
import { OpcionesTarjeta, type OpcionTarjeta } from '@/components/ui/OpcionesTarjeta';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { ErrorFotos, type PasoBorrado, useBorrarCuenta } from '@/features/cuenta/api';
import { useMisAnimales } from '@/features/reportes/api';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { AlBorrarCuenta } from '@/types/dominio';

// Dejarlo publicado va primero: es la opción por defecto.
const OPCIONES: OpcionTarjeta<AlBorrarCuenta>[] = [
  { valor: 'conservar', ...t.cuenta.borrar.opciones.conservar },
  { valor: 'borrar', ...t.cuenta.borrar.opciones.borrar },
];

/**
 * Perfil › Borrar mi cuenta. La persona elige qué pasa con lo abierto y
 * confirma que entiende que no se puede deshacer. Al terminar, vuelve al mapa.
 */
export default function PantallaBorrarCuenta() {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const { usuario, cargando } = useAuth();
  const misAnimales = useMisAnimales(usuario?.id);
  const [alBorrar, setAlBorrar] = useState<AlBorrarCuenta>('conservar');
  const [confirmo, setConfirmo] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [paso, setPaso] = useState<PasoBorrado | null>(null);
  const borrar = useBorrarCuenta(setPaso);

  const abiertos =
    misAnimales.data?.filter((a) => a.estado === 'avistado' || a.estado === 'resguardado').length ??
    0;

  const enviar = () => {
    setIntentado(true);
    if (!confirmo) return;
    borrar.mutate(alBorrar);
  };

  if (cargando) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando />
      </Pantalla>
    );
  }

  const error = borrar.isError
    ? borrar.error instanceof ErrorFotos
      ? t.cuenta.borrar.errorFotos
      : borrar.error.message || t.comunes.errorGenerico
    : null;

  return (
    <Pantalla
      scroll
      bordes={['left', 'right']}
      ancho={AnchoMaximo.lista}
      pie={
        <View style={estilos.pie}>
          {error ? <Mensaje texto={error} tipo="error" /> : null}
          {borrar.isPending && paso ? (
            <Texto variante="secundario" style={estilos.centrado} accessibilityLiveRegion="polite">
              {paso === 'fotos' ? t.cuenta.borrar.borrandoFotos : t.cuenta.borrar.borrandoCuenta}
            </Texto>
          ) : null}
          <Boton
            titulo={t.cuenta.borrar.boton}
            icono="trash-outline"
            variante="peligro"
            cargando={borrar.isPending}
            onPress={enviar}
          />
        </View>
      }>
      <Mensaje texto={t.cuenta.borrar.intro} tipo="error" />

      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {t.cuenta.borrar.seBorra}
        </Texto>
        {t.cuenta.borrar.seBorraLista.map((linea) => (
          <View key={linea} style={estilos.linea}>
            <Ionicons name="trash-outline" size={18} color={c.textoSecundario} />
            <Texto color="textoCuerpo" style={estilos.textoLinea}>
              {linea}
            </Texto>
          </View>
        ))}
      </View>

      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {t.cuenta.borrar.abiertos}
        </Texto>
        {abiertos > 0 ? (
          <Texto variante="secundario">{t.cuenta.borrar.abiertosCantidad(abiertos)}</Texto>
        ) : null}
        <OpcionesTarjeta
          opciones={OPCIONES}
          valor={alBorrar}
          onCambio={setAlBorrar}
          accessibilityLabel={t.cuenta.borrar.abiertos}
        />
      </View>

      <Casilla
        etiqueta={t.cuenta.borrar.confirmo}
        valor={confirmo}
        onCambio={setConfirmo}
        error={intentado && !confirmo ? t.legal.aceptar.falta : null}
      />
    </Pantalla>
  );
}

const crear = crearEstilos(() => ({
  pie: { gap: Espacio.s },
  centrado: { textAlign: 'center' },
  seccion: { gap: Espacio.sm, marginTop: Espacio.s },
  linea: { flexDirection: 'row', alignItems: 'flex-start', gap: Espacio.sm },
  textoLinea: { flex: 1 },
}));

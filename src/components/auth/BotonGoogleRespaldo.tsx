import { useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Espacio } from '@/constants/tema';
import { ingresarConGoogle } from '@/features/auth/acciones';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/**
 * El botón de siempre para ingresar con Google: pasa por Supabase
 * (signInWithOAuth). Lo usan la app nativa y la web cuando no hay ID de
 * cliente o el script de Google no cargó (IngresoGoogle.web.tsx).
 */
export function BotonGoogleRespaldo({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingresar = async () => {
    setCargando(true);
    setError(null);
    try {
      await ingresarConGoogle();
    } catch (e) {
      setError(mensajeDeError(e, t.auth.errores.desconocido));
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={{ gap: Espacio.m }}>
      {error ? <Mensaje texto={error} tipo="error" /> : null}
      <Boton
        titulo={t.auth.conGoogle}
        icono="logo-google"
        variante="secundario"
        cargando={cargando}
        deshabilitado={deshabilitado || cargando}
        onPress={() => void ingresar()}
      />
    </View>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';

import { MarcaAcceso } from '@/components/auth/Acceso';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo } from '@/constants/tema';
import { cambiarContrasena } from '@/features/auth/acciones';
import { useAuth } from '@/features/auth/AuthProvider';
import { cancelarRecuperacion, useRecuperacion } from '@/features/auth/recuperacion';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/**
 * Al volver del link de recuperación se elige la contraseña nueva. La sesión
 * del link puede estar en la app (el link viejo, con ?code=) o solo en
 * memoria (el de /auth/confirmar): por eso se mira useRecuperacion y no la
 * sesión. Antes de elegir, la persona ve de qué cuenta es y puede decir que
 * no es la suya (recuperacion.ts).
 */
export default function PantallaNuevaContrasena() {
  const router = useRouter();
  const { cargando } = useAuth();
  const { activa, linkInvalido, cuenta } = useRecuperacion();
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ conSesion: boolean } | null>(null);

  if (cargando) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando />
      </Pantalla>
    );
  }

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      setListo(await cambiarContrasena(contrasena, repetida));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const noEsMiCuenta = async () => {
    setCancelando(true);
    try {
      await cancelarRecuperacion();
    } finally {
      setCancelando(false);
      router.replace('/');
    }
  };

  const irAlMapa = () => router.replace('/');

  if (listo) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
        <MarcaAcceso />
        {listo.conSesion ? (
          <>
            <Mensaje texto={t.auth.nuevaContrasena.exito} tipo="exito" />
            <Boton
              titulo={t.auth.nuevaContrasena.irAlMapa}
              icono="map-outline"
              onPress={irAlMapa}
            />
          </>
        ) : (
          <>
            <Mensaje texto={t.auth.nuevaContrasena.exitoSinSesion} tipo="exito" />
            <Boton
              titulo={t.auth.ingresar}
              icono="log-in-outline"
              onPress={() => router.replace('/auth/ingresar')}
            />
          </>
        )}
      </Pantalla>
    );
  }

  // Sin un link de recuperación abierto no hay contraseña que cambiar.
  if (linkInvalido || !activa) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
        <MarcaAcceso />
        <Mensaje texto={t.auth.nuevaContrasena.linkVencido} tipo="error" />
        <Boton
          titulo={t.auth.nuevaContrasena.pedirOtro}
          icono="mail-outline"
          onPress={() => router.replace('/auth/recuperar')}
        />
      </Pantalla>
    );
  }

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
      <MarcaAcceso />
      {cuenta ? <Texto>{t.auth.nuevaContrasena.cuenta(cuenta)}</Texto> : null}
      <Texto variante="secundario">{t.auth.nuevaContrasena.noEsMiCuentaAyuda}</Texto>
      <Texto variante="secundario">{t.auth.nuevaContrasena.intro}</Texto>

      <CampoTexto
        etiqueta={t.auth.nuevaContrasena.contrasena}
        placeholder={t.auth.contrasenaPlaceholder}
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <CampoTexto
        etiqueta={t.auth.nuevaContrasena.repetir}
        value={repetida}
        onChangeText={setRepetida}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void guardar()}
      />

      {error ? <Mensaje texto={error} tipo="error" /> : null}

      <Boton
        titulo={t.auth.nuevaContrasena.guardar}
        icono="key-outline"
        cargando={guardando}
        deshabilitado={cancelando}
        onPress={() => void guardar()}
      />
      <Boton
        titulo={t.auth.nuevaContrasena.noEsMiCuenta}
        variante="fantasma"
        icono="close-circle-outline"
        cargando={cancelando}
        deshabilitado={guardando}
        onPress={() => void noEsMiCuenta()}
      />
    </Pantalla>
  );
}

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
import { terminarRecuperacion, useRecuperacion } from '@/features/auth/recuperacion';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/**
 * Al volver del link de recuperación: Supabase ya abrió una sesión (evento
 * PASSWORD_RECOVERY) y acá se elige la contraseña nueva con updateUser.
 */
export default function PantallaNuevaContrasena() {
  const router = useRouter();
  const { usuario, cargando } = useAuth();
  const { activa, linkInvalido } = useRecuperacion();
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

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
      await cambiarContrasena(contrasena, repetida);
      terminarRecuperacion();
      setListo(true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const irAlMapa = () => router.replace('/');

  if (listo) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
        <MarcaAcceso />
        <Mensaje texto={t.auth.nuevaContrasena.exito} tipo="exito" />
        <Boton titulo={t.auth.nuevaContrasena.irAlMapa} icono="map-outline" onPress={irAlMapa} />
      </Pantalla>
    );
  }

  // Sin una sesión abierta por el link no hay contraseña que cambiar.
  if (linkInvalido || !activa || !usuario) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
        <MarcaAcceso />
        <Mensaje texto={t.auth.nuevaContrasena.linkVencido} tipo="error" />
        {usuario ? (
          <Boton titulo={t.auth.nuevaContrasena.irAlMapa} icono="map-outline" onPress={irAlMapa} />
        ) : (
          <Boton
            titulo={t.auth.nuevaContrasena.pedirOtro}
            icono="mail-outline"
            onPress={() => router.replace('/auth/recuperar')}
          />
        )}
      </Pantalla>
    );
  }

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
      <MarcaAcceso />
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
        onPress={() => void guardar()}
      />
    </Pantalla>
  );
}

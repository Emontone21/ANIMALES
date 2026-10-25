import { useRouter } from 'expo-router';
import { lazy, Suspense, useState } from 'react';

import { CambiarAcceso, MarcaAcceso, SeparadorO } from '@/components/auth/Acceso';
import { Captcha } from '@/components/auth/Captcha';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { AnchoMaximo } from '@/constants/tema';
import { ingresarConEmail } from '@/features/auth/acciones';
import { useCaptcha } from '@/features/auth/useCaptcha';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

// Google va en un bloque aparte: en web baja su script recién al abrir esta pantalla.
const IngresoGoogle = lazy(() => import('@/components/auth/IngresoGoogle'));

export default function PantallaIngresar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  // Al abrir sesión, Stack.Protected cierra esta pantalla solo. Cada intento
  // usa el token del captcha; Google no lo lleva.
  const conEmail = async () => {
    setCargando(true);
    setError(null);
    try {
      await ingresarConEmail(email, contrasena, captcha.token).finally(captcha.reiniciar);
    } catch (e) {
      setError(mensajeDeError(e, t.auth.errores.desconocido));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
      <MarcaAcceso />

      <CampoTexto
        etiqueta={t.auth.email}
        placeholder={t.auth.emailPlaceholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <CampoTexto
        etiqueta={t.auth.contrasena}
        placeholder={t.auth.contrasenaPlaceholder}
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void conEmail()}
      />

      <Captcha {...captcha.props} />
      {error ? <Mensaje texto={error} tipo="error" /> : null}

      <Boton
        titulo={t.auth.ingresar}
        cargando={cargando}
        deshabilitado={cargando}
        onPress={() => void conEmail()}
      />
      <Boton
        titulo={t.auth.olvidaste}
        variante="fantasma"
        onPress={() => router.push('/auth/recuperar')}
      />

      <SeparadorO />
      <Suspense fallback={null}>
        <IngresoGoogle deshabilitado={cargando} />
      </Suspense>

      <CambiarAcceso
        pregunta={t.auth.sinCuenta}
        accion={t.auth.registrarse}
        destino={'/auth/registrarse'}
      />
    </Pantalla>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CambiarAcceso, MarcaAcceso } from '@/components/auth/Acceso';
import { Captcha } from '@/components/auth/Captcha';
import { EnlacesLegales } from '@/components/legal/EnlacesLegales';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Casilla } from '@/components/ui/Casilla';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { AnchoMaximo } from '@/constants/tema';
import { registrarse } from '@/features/auth/acciones';
import { useCaptcha } from '@/features/auth/useCaptcha';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

export default function PantallaRegistrarse() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const captcha = useCaptcha();

  const enviar = async () => {
    setIntentado(true);
    setCargando(true);
    setError(null);
    try {
      const { requiereConfirmacion } = await registrarse(
        nombre,
        email,
        contrasena,
        acepta,
        captcha.token,
      );
      if (requiereConfirmacion) {
        // Sin sesión todavía: la pantalla sigue visible, avisamos y volvemos.
        setExito(true);
        setTimeout(() => router.back(), 2500);
      }
      // Con sesión, Stack.Protected cierra la pantalla solo.
    } catch (e) {
      setError(mensajeDeError(e, t.auth.errores.desconocido));
    } finally {
      setCargando(false);
      captcha.reiniciar();
    }
  };

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
      <MarcaAcceso />

      <CampoTexto
        etiqueta={t.auth.nombre}
        placeholder={t.auth.nombrePlaceholder}
        ayuda={t.auth.nombreAyuda}
        value={nombre}
        onChangeText={setNombre}
        autoComplete="name"
        maxLength={40}
      />
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
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void enviar()}
      />

      <Casilla
        etiqueta={t.auth.aceptoTerminos}
        valor={acepta}
        onCambio={setAcepta}
        error={intentado && !acepta ? t.legal.aceptar.falta : null}
      />
      <EnlacesLegales />

      <Captcha {...captcha.props} />
      {error ? <Mensaje texto={error} tipo="error" /> : null}
      {exito ? <Mensaje texto={t.auth.registroExito} tipo="exito" /> : null}

      <Boton
        titulo={t.auth.registrarse}
        cargando={cargando}
        deshabilitado={exito}
        onPress={() => void enviar()}
      />

      <CambiarAcceso
        pregunta={t.auth.conCuenta}
        accion={t.auth.ingresar}
        destino={'/auth/ingresar'}
      />
    </Pantalla>
  );
}

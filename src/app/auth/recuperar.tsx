import { useRouter } from 'expo-router';
import { useState } from 'react';

import { MarcaAcceso } from '@/components/auth/Acceso';
import { Captcha } from '@/components/auth/Captcha';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo } from '@/constants/tema';
import { pedirRecuperacion } from '@/features/auth/acciones';
import { useCaptcha } from '@/features/auth/useCaptcha';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/** "¿Olvidaste tu contraseña?": pide el email y manda el link para elegir una nueva. */
export default function PantallaRecuperar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const captcha = useCaptcha();

  const enviar = async () => {
    setCargando(true);
    setError(null);
    try {
      await pedirRecuperacion(email, captcha.token);
      // Mismo mensaje exista o no la cuenta: no revela qué emails están registrados.
      setEnviado(true);
    } catch (e) {
      setError(mensajeDeError(e, t.auth.recuperar.error));
    } finally {
      setCargando(false);
      captcha.reiniciar();
    }
  };

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
      <MarcaAcceso />
      <Texto variante="secundario">{t.auth.recuperar.intro}</Texto>

      <CampoTexto
        etiqueta={t.auth.email}
        placeholder={t.auth.emailPlaceholder}
        value={email}
        onChangeText={(texto) => {
          setEmail(texto);
          setEnviado(false);
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={() => void enviar()}
      />

      <Captcha {...captcha.props} />
      {error ? <Mensaje texto={error} tipo="error" /> : null}
      {enviado ? <Mensaje texto={t.auth.recuperar.enviado} tipo="exito" /> : null}

      <Boton
        titulo={t.auth.recuperar.enviar}
        icono="mail-outline"
        cargando={cargando}
        deshabilitado={enviado}
        onPress={() => void enviar()}
      />
      <Boton
        titulo={t.auth.recuperar.volver}
        variante="fantasma"
        onPress={() => router.replace('/auth/ingresar')}
      />
    </Pantalla>
  );
}

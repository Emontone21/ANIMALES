import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CambiarAcceso, MarcaAcceso } from '@/components/auth/Acceso';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { ingresarConEmail, ingresarConGoogle } from '@/features/auth/acciones';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

export default function PantallaIngresar() {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al abrir sesión, Stack.Protected cierra esta pantalla solo.
  const ejecutar = async (tipo: 'email' | 'google', accion: () => Promise<void>) => {
    setCargando(tipo);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.errores.desconocido);
    } finally {
      setCargando(null);
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
        onSubmitEditing={() => void ejecutar('email', () => ingresarConEmail(email, contrasena))}
      />

      {error ? <Mensaje texto={error} tipo="error" /> : null}

      <Boton
        titulo={t.auth.ingresar}
        cargando={cargando === 'email'}
        deshabilitado={cargando !== null}
        onPress={() => void ejecutar('email', () => ingresarConEmail(email, contrasena))}
      />
      <Boton
        titulo={t.auth.olvidaste}
        variante="fantasma"
        onPress={() => router.push('/auth/recuperar')}
      />

      <View style={estilos.separador}>
        <View style={estilos.linea} />
        <Texto variante="pequeno">{t.auth.o}</Texto>
        <View style={estilos.linea} />
      </View>

      <Boton
        titulo={t.auth.conGoogle}
        icono="logo-google"
        variante="secundario"
        cargando={cargando === 'google'}
        deshabilitado={cargando !== null}
        onPress={() => void ejecutar('google', ingresarConGoogle)}
      />

      <CambiarAcceso
        pregunta={t.auth.sinCuenta}
        accion={t.auth.registrarse}
        destino={'/auth/registrarse'}
      />
    </Pantalla>
  );
}

const crear = crearEstilos((c) => ({
  separador: { flexDirection: 'row', alignItems: 'center', gap: Espacio.m },
  linea: { flex: 1, height: 1, backgroundColor: c.borde },
}));

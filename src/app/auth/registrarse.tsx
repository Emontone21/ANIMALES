import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';
import { registrarse } from '@/features/auth/acciones';
import { t } from '@/i18n/es-UY';

export default function PantallaRegistrarse() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const enviar = async () => {
    setCargando(true);
    setError(null);
    try {
      const { requiereConfirmacion } = await registrarse(nombre, email, contrasena);
      if (requiereConfirmacion) {
        // Sin sesión todavía: la pantalla sigue visible, avisamos y volvemos.
        setExito(true);
        setTimeout(() => router.back(), 2500);
      }
      // Con sesión, Stack.Protected cierra la pantalla solo.
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.errores.desconocido);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']}>
      <Texto variante="titulo">{t.auth.registrarse}</Texto>

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

      {error ? <Mensaje texto={error} tipo="error" /> : null}
      {exito ? <Mensaje texto={t.auth.registroExito} tipo="exito" /> : null}

      <Boton
        titulo={t.auth.registrarse}
        cargando={cargando}
        deshabilitado={exito}
        onPress={() => void enviar()}
      />

      <View style={estilos.pie}>
        <Texto variante="secundario">{t.auth.conCuenta}</Texto>
        <Link href="/auth/ingresar" replace style={estilos.enlace}>
          {t.auth.ingresar}
        </Link>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  pie: { flexDirection: 'row', justifyContent: 'center', gap: Espacio.s, marginTop: Espacio.m },
  enlace: { color: Colores.primario, fontWeight: '600', fontSize: 14 },
});

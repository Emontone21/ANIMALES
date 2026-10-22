import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';

import { RielNavegacion } from '@/components/ui/BarraNavegacion';
import { BotonVolver } from '@/components/ui/BotonVolver';
import { Fuentes } from '@/constants/tema';
import { useAparienciaHidratada } from '@/features/apariencia/preferencia';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useRecuperacion } from '@/features/auth/recuperacion';
import { usePush } from '@/features/notificaciones/push';
import { precargarRutaInicial } from '@/features/reportes/precarga';
import { useDisposicion } from '@/hooks/useDisposicion';
import { useFuentes } from '@/hooks/useFuentes';
import { useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { activarFuentesWeb } from '@/lib/fuentesWeb';
import { ocultarPantallaCarga } from '@/lib/pantallaCarga';
import { anotarRuta } from '@/lib/rutasRecientes';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// En web, lo que muestra la ruta de entrada se pide ya: no espera a que carguen
// sus pantallas ni el mapa.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  precargarRutaInicial(queryClient, window.location.pathname);
}

/**
 * En web, las fuentes se activan después de las fotos que se ven al abrir
 * (useCargarMapa); en las pantallas sin mapa, pasado este plazo.
 */
const PLAZO_FUENTES_MS = 4000;

export default function RootLayout() {
  const fuentesListas = useFuentes();
  const aparienciaLista = useAparienciaHidratada();

  if (!fuentesListas || !aparienciaLista) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TemaNavegacion>
          <Navegacion />
        </TemaNavegacion>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** Tema de navegación, barra de estado y fondo del documento web según el esquema. */
function TemaNavegacion({ children }: { children: React.ReactNode }) {
  const { c, esquema } = useTema();
  const oscuro = esquema === 'oscuro';

  const tema = useMemo(() => {
    const base = oscuro ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: oscuro,
      colors: {
        ...base.colors,
        primary: c.primario,
        background: c.fondo,
        card: c.superficie,
        text: c.texto,
        border: c.borde,
        notification: c.primario,
      },
    };
  }, [c, oscuro]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const raiz = document.documentElement;
    raiz.style.colorScheme = oscuro ? 'dark' : 'light';
    raiz.style.backgroundColor = c.fondo;
    // public/index.html usa esta variable para el anillo de foco.
    raiz.style.setProperty('--color-foco', c.primario);
    document.body.style.backgroundColor = c.fondo;
    document.title = t.app.tituloWeb;
    ocultarPantallaCarga();
  }, [c, oscuro]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const plazo = setTimeout(activarFuentesWeb, PLAZO_FUENTES_MS);
    return () => clearTimeout(plazo);
  }, []);

  return (
    <ThemeProvider value={tema}>
      <StatusBar style={oscuro ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

function Navegacion() {
  const { usuario, cargando } = useAuth();
  const { c } = useTema();
  const router = useRouter();
  const ruta = usePathname();
  const amplio = useDisposicion() === 'amplio';
  const recuperando = useRecuperacion((estado) => estado.activa);
  usePush(usuario?.id);

  // La pantalla anterior, para "Reportar un error" (src/lib/rutasRecientes.ts).
  useEffect(() => anotarRuta(ruta), [ruta]);

  // Al volver de un link de recuperación (aunque Supabase lo haya mandado a la
  // raíz), lo primero es elegir la contraseña nueva.
  useEffect(() => {
    if (recuperando && ruta !== '/auth/nueva-contrasena') router.replace('/auth/nueva-contrasena');
    // Solo cuando empieza la recuperación: después se puede salir de esa pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recuperando]);

  useEffect(() => {
    if (!cargando) {
      SplashScreen.hideAsync();
    }
  }, [cargando]);

  // En computadoras el riel de navegación queda a la izquierda en todas las
  // pantallas, también en el detalle y en las que no son pestañas (8.1 a 8.3).
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.fondo }}>
      {amplio ? <RielNavegacion /> : null}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerTintColor: c.texto,
            headerStyle: { backgroundColor: c.superficie },
            headerTitleStyle: { ...Fuentes.titulo, fontSize: 20, color: c.texto },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            // En web, Volver de 44 × 44 y en español; en nativo, el del sistema.
            headerLeft: Platform.OS === 'web' ? (props) => <BotonVolver {...props} /> : undefined,
            contentStyle: { backgroundColor: c.fondo },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* El detalle dibuja sus propios botones flotantes sobre la foto. */}
          <Stack.Screen
            name="animal/[id]/index"
            options={{ title: t.animal.titulo, headerShown: false }}
          />
          {/* El mapa en grande del recorrido también: botones flotantes sobre el mapa. */}
          <Stack.Screen
            name="animal/[id]/mapa"
            options={{ title: t.mapa.recorrido.titulo, headerShown: false }}
          />
          <Stack.Screen name="casos" options={{ title: t.mapa.lista.titulo }} />
          {/* Públicas y sin cuenta. */}
          <Stack.Screen name="reencuentros/index" options={{ title: t.reencuentros.titulo }} />
          <Stack.Screen name="reencuentros/[id]" options={{ title: t.reencuentros.titulo }} />
          <Stack.Screen name="conversacion/[id]" options={{ title: t.mensajes.titulo }} />
          <Stack.Screen name="moderacion" options={{ title: t.moderacion.titulo }} />
          {/* Se leen sin cuenta. */}
          <Stack.Screen name="legal/terminos" options={{ title: t.legal.terminos.titulo }} />
          <Stack.Screen name="legal/privacidad" options={{ title: t.legal.privacidad.titulo }} />
          {/* Con o sin sesión: el link de recuperación abre una. */}
          <Stack.Screen
            name="auth/nueva-contrasena"
            options={{ title: t.auth.nuevaContrasena.titulo }}
          />
          {/* El link de los mails: se abre en cualquier navegador, con sesión o sin ella. */}
          <Stack.Screen name="auth/confirmar" options={{ title: t.auth.confirmar.titulo }} />

          {/* Solo sin sesión. Al ingresar, el router cierra estas pantallas solo. */}
          <Stack.Protected guard={!usuario}>
            <Stack.Screen
              name="auth/ingresar"
              options={{ title: t.auth.ingresar, presentation: 'modal' }}
            />
            <Stack.Screen
              name="auth/registrarse"
              options={{ title: t.auth.registrarse, presentation: 'modal' }}
            />
            <Stack.Screen
              name="auth/recuperar"
              options={{ title: t.auth.recuperar.titulo, presentation: 'modal' }}
            />
          </Stack.Protected>

          {/* Solo con sesión. Al cerrarla o borrar la cuenta, se cierran solas.
              Mientras se restaura la sesión siguen disponibles: si no, abrir
              /cuenta/editar directo en web llevaba al mapa. */}
          <Stack.Protected guard={cargando || !!usuario}>
            <Stack.Screen name="cuenta/editar" options={{ title: t.cuenta.editar.titulo }} />
            <Stack.Screen name="cuenta/borrar" options={{ title: t.cuenta.borrar.titulo }} />
            <Stack.Screen name="animal/[id]/editar" options={{ title: t.editarReporte.titulo }} />
            <Stack.Screen
              name="animal/[id]/reencuentro"
              options={{ title: t.reencuentros.contar.titulo }}
            />
          </Stack.Protected>
        </Stack>
      </View>
    </View>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

// Solo aplica en web (Metro lo ignora en nativo): estilos del mapa MapLibre GL.
import 'maplibre-gl/dist/maplibre-gl.css';

import { Colores } from '@/constants/tema';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { usePush } from '@/features/notificaciones/push';
import { t } from '@/i18n/es-UY';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Navegacion />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Navegacion() {
  const { usuario, cargando } = useAuth();
  usePush(usuario?.id);

  useEffect(() => {
    if (!cargando) {
      SplashScreen.hideAsync();
    }
  }, [cargando]);

  return (
    <Stack
      screenOptions={{
        headerTintColor: Colores.primario,
        headerTitleStyle: { color: Colores.texto },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: Colores.fondo },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="animal/[id]" options={{ title: t.animal.titulo }} />
      <Stack.Screen name="conversacion/[id]" options={{ title: t.mensajes.titulo }} />
      <Stack.Screen name="moderacion" options={{ title: t.moderacion.titulo }} />

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
      </Stack.Protected>
    </Stack>
  );
}

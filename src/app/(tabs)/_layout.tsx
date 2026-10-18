import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { Colores } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

function icono(nombre: NombreIcono, extra = 0) {
  return function IconoTab({ focused, size }: { focused: boolean; size: number }) {
    return (
      <Ionicons
        name={nombre}
        size={size + extra}
        color={focused ? Colores.primario : Colores.textoSecundario}
      />
    );
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colores.primario,
        tabBarInactiveTintColor: Colores.textoSecundario,
        tabBarStyle: { backgroundColor: Colores.fondo, borderTopColor: Colores.borde },
      }}>
      <Tabs.Screen name="index" options={{ title: t.tabs.mapa, tabBarIcon: icono('map') }} />
      <Tabs.Screen
        name="publicar"
        options={{ title: t.tabs.publicar, tabBarIcon: icono('add-circle', 4) }}
      />
      <Tabs.Screen name="perfil" options={{ title: t.tabs.perfil, tabBarIcon: icono('person') }} />
    </Tabs>
  );
}

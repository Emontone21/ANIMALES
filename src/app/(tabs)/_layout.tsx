import { Tabs } from 'expo-router/js-tabs';

import { BarraNavegacion } from '@/components/ui/BarraNavegacion';
import { useDisposicion } from '@/hooks/useDisposicion';
import { useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

export default function TabsLayout() {
  const { c } = useTema();
  // En computadoras la navegación es el riel del layout raíz (docs/DISENO.md, 8.1).
  const amplio = useDisposicion() === 'amplio';
  return (
    <Tabs
      tabBar={(props) => (amplio ? null : <BarraNavegacion {...props} />)}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.fondo } }}>
      <Tabs.Screen name="index" options={{ title: t.tabs.mapa }} />
      <Tabs.Screen name="publicar" options={{ title: t.tabs.publicar }} />
      <Tabs.Screen name="actividad" options={{ title: t.tabs.actividad }} />
      <Tabs.Screen name="perfil" options={{ title: t.tabs.perfil }} />
    </Tabs>
  );
}

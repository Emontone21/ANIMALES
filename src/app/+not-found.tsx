import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

export default function NoEncontrado() {
  const router = useRouter();
  const estilos = useEstilos(crear);
  return (
    <>
      <Stack.Screen options={{ title: t.app.nombre }} />
      <View style={estilos.contenedor}>
        <Texto variante="subtitulo" style={estilos.centrado}>
          {t.animal.noEncontrado}
        </Texto>
        <Boton
          titulo={t.comunes.volverAlMapa}
          icono="map-outline"
          onPress={() => router.replace('/')}
          style={estilos.boton}
        />
      </View>
    </>
  );
}

const crear = crearEstilos((c) => ({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.l,
    padding: Espacio.l,
    backgroundColor: c.fondo,
  },
  centrado: { textAlign: 'center', maxWidth: AnchoMaximo.acceso },
  boton: { width: '100%', maxWidth: AnchoMaximo.acceso },
}));

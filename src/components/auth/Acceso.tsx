import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Fuentes } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** El nombre de la app en Fredoka 32 y su lema, arriba de ingresar y registrarse (7.7). */
export function MarcaAcceso() {
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.marca}>
      <Text style={estilos.nombre} accessibilityRole="header">
        {t.app.nombre}
      </Text>
      <Texto variante="secundario" style={estilos.centrado}>
        {t.app.lema}
      </Texto>
    </View>
  );
}

/** Pregunta y enlace para pasar de ingresar a registrarse, o al revés. */
export function CambiarAcceso({
  pregunta,
  accion,
  destino,
}: {
  pregunta: string;
  accion: string;
  destino: Href;
}) {
  const router = useRouter();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.cambiar}>
      <Texto variante="secundario" style={estilos.centrado}>
        {pregunta}
      </Texto>
      <Boton titulo={accion} variante="fantasma" onPress={() => router.replace(destino)} />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  marca: { alignItems: 'center', gap: Espacio.xs, marginBottom: Espacio.s },
  nombre: { ...Fuentes.titulo, fontSize: 32, lineHeight: 38, color: c.texto, textAlign: 'center' },
  centrado: { textAlign: 'center' },
  cambiar: { alignItems: 'center', marginTop: Espacio.s },
}));

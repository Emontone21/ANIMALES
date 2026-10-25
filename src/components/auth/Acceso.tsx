import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { View } from 'react-native';

import logoClaro from '@/assets/marca/spot-logo.svg';
import logoOscuro from '@/assets/marca/spot-logo-oscuro.svg';
import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** El logo completo (assets/marca/, 274 × 107) a 180 de ancho (DISENO.md, 5.2). */
const ANCHO_LOGO = 180;
const PROPORCION_LOGO = 274 / 107;

/** El logo, en claro u oscuro, y el lema, arriba de ingresar y registrarse (7.7). */
export function MarcaAcceso() {
  const { esquema } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.marca}>
      {/* El encabezado de la pantalla es el logo: "Spot" para el lector, en web y en nativo. */}
      <Image
        source={esquema === 'oscuro' ? logoOscuro : logoClaro}
        style={estilos.logo}
        contentFit="contain"
        priority="high"
        loading="eager"
        accessible
        accessibilityRole="header"
        accessibilityLabel={t.app.nombre}
      />
      <Texto variante="secundario" style={estilos.centrado}>
        {t.app.lema}
      </Texto>
    </View>
  );
}

/** La línea con "o" entre el email y Google, en ingresar y registrarse. */
export function SeparadorO() {
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.separador}>
      <View style={estilos.linea} />
      <Texto variante="pequeno">{t.auth.o}</Texto>
      <View style={estilos.linea} />
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
  marca: { alignItems: 'center', gap: Espacio.s, marginBottom: Espacio.s },
  logo: { width: ANCHO_LOGO, aspectRatio: PROPORCION_LOGO },
  centrado: { textAlign: 'center' },
  cambiar: { alignItems: 'center', marginTop: Espacio.s },
  separador: { flexDirection: 'row', alignItems: 'center', gap: Espacio.m },
  linea: { flex: 1, height: 1, backgroundColor: c.borde },
}));

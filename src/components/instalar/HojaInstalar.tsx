import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { Mensaje } from '@/components/ui/Mensaje';
import { MenuOpciones } from '@/components/ui/MenuOpciones';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import type { AppConNavegador } from '@/features/instalar/formaDeInstalar';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';
import { copiarLink } from '@/lib/hojaCompartir';

type Props = {
  forma: 'pasosIos' | 'abrirEnNavegador';
  app: AppConNavegador | null;
  onCerrar: () => void;
};

/**
 * Las hojas de "Instalar la app" donde no hay ventana del navegador: los pasos
 * en iPhone y iPad, y abrir el link en Chrome o Safari desde el navegador de
 * WhatsApp, Instagram o Facebook. Va en un bloque aparte (lo carga Perfil al
 * tocar el botón): no suma a la carga inicial.
 */
export default function HojaInstalar({ forma, app, onCerrar }: Props) {
  return forma === 'pasosIos' ? (
    <PasosIos onCerrar={onCerrar} />
  ) : (
    <AbrirEnNavegador app={app} onCerrar={onCerrar} />
  );
}

function PasosIos({ onCerrar }: { onCerrar: () => void }) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const pasos = [t.instalar.ios.compartir, t.instalar.ios.agregarAInicio, t.instalar.ios.agregar];
  return (
    <MenuOpciones
      visible
      titulo={t.instalar.ios.titulo}
      contenido={
        <View style={estilos.pasos}>
          {pasos.map((paso, i) => (
            <View key={paso} style={estilos.paso}>
              <View style={estilos.numero}>
                <Texto variante="etiqueta" color="textoPrimarioSuave">
                  {i + 1}
                </Texto>
              </View>
              <Texto style={estilos.textoPaso}>{paso}</Texto>
              {/* El ícono de Compartir de Safari: un cuadrado con una flecha hacia arriba. */}
              {i === 0 ? (
                <View style={estilos.icono} accessibilityElementsHidden aria-hidden>
                  <Ionicons name="share-outline" size={22} color={c.primario} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      }
      opciones={[]}
      textoCerrar={t.instalar.entendido}
      onCerrar={onCerrar}
    />
  );
}

function AbrirEnNavegador({
  app,
  onCerrar,
}: {
  app: AppConNavegador | null;
  onCerrar: () => void;
}) {
  const estilos = useEstilos(crear);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  // El link del sitio (el de producción, como los que se comparten).
  const link = `${ENV.siteUrl}/`;

  const copiar = async () => {
    const ok = await copiarLink(link);
    setAviso({ ok, texto: ok ? t.compartir.copiado : t.compartir.errorCopiar });
  };

  return (
    <MenuOpciones
      visible
      titulo={t.instalar.navegadorInterno.titulo}
      descripcion={t.instalar.navegadorInterno.explicacion(
        app ?? t.instalar.navegadorInterno.estaApp,
      )}
      contenido={
        <View style={estilos.link}>
          <Texto variante="cuerpoFuerte" selectable>
            {link}
          </Texto>
          {aviso ? <Mensaje texto={aviso.texto} tipo={aviso.ok ? 'exito' : 'error'} /> : null}
        </View>
      }
      opciones={[
        {
          titulo: t.compartir.copiar,
          icono: 'copy-outline',
          variante: 'primario',
          onPress: () => void copiar(),
        },
      ]}
      onCerrar={onCerrar}
    />
  );
}

const crear = crearEstilos((c) => ({
  pasos: { gap: Espacio.m, marginTop: Espacio.xs, marginBottom: Espacio.s },
  paso: { flexDirection: 'row', alignItems: 'center', gap: Espacio.sm },
  numero: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: c.primarioSuave,
  },
  textoPaso: { flex: 1 },
  icono: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.s,
    backgroundColor: c.superficieSuave,
  },
  link: { gap: Espacio.sm },
}));

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { SelectorUbicacion } from '@/components/mapa/SelectorUbicacion';
import { type FotoElegida, SelectorFoto } from '@/components/reportes/SelectorFoto';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Chips } from '@/components/ui/Chips';
import { Interruptor } from '@/components/ui/Interruptor';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { ColorEspecie, Colores, Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicarAnimal } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { hace } from '@/lib/fechas';
import { obtenerPosicionActual } from '@/lib/ubicacion';
import { ESPECIES, type Especie, type LngLat, TAMANIOS, type Tamanio } from '@/types/dominio';

type Cuando = keyof typeof t.publicar.cuandoOpciones;

const HORAS_POR_CUANDO: Record<Cuando, number> = {
  ahora: 0,
  hace1h: 1,
  hace3h: 3,
  hoy: 8,
  ayer: 24,
};

const OPCIONES_CUANDO = (Object.keys(HORAS_POR_CUANDO) as Cuando[]).map((valor) => ({
  valor,
  etiqueta: t.publicar.cuandoOpciones[valor],
}));

const OPCIONES_ESPECIE = ESPECIES.map((valor) => ({
  valor,
  etiqueta: t.especie[valor],
  color: ColorEspecie[valor],
}));

const OPCIONES_TAMANIO = TAMANIOS.map((valor) => ({ valor, etiqueta: t.tamanio[valor] }));

export default function PantallaPublicar() {
  const { usuario, cargando } = useAuth();

  if (cargando) return <Pantalla>{null}</Pantalla>;
  if (!usuario) {
    return (
      <Pantalla>
        <RequiereCuenta mensaje={t.publicar.requiereCuenta} />
      </Pantalla>
    );
  }
  return <FormularioPublicar usuarioId={usuario.id} />;
}

function FormularioPublicar({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const publicar = usePublicarAnimal(usuarioId);

  const [foto, setFoto] = useState<FotoElegida | null>(null);
  const [especie, setEspecie] = useState<Especie>('perro');
  const [tamanio, setTamanio] = useState<Tamanio | null>(null);
  const [color, setColor] = useState('');
  const [tieneCollar, setTieneCollar] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [cuando, setCuando] = useState<Cuando>('ahora');
  const [ubicacion, setUbicacion] = useState<LngLat | null>(null);
  const [eligiendoEnMapa, setEligiendoEnMapa] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [avisoGps, setAvisoGps] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const errorFoto = intentado && !foto ? t.publicar.fotoObligatoria : null;
  const errorUbicacion = intentado && !ubicacion ? t.publicar.ubicacionFaltante : null;

  const usarGps = async () => {
    setBuscandoGps(true);
    setAvisoGps(null);
    const posicion = await obtenerPosicionActual();
    setBuscandoGps(false);
    if (posicion) {
      setUbicacion(posicion);
    } else {
      setAvisoGps(t.publicar.permisoUbicacion);
    }
  };

  const enviar = () => {
    setIntentado(true);
    if (!foto || !ubicacion) return;

    publicar.mutate(
      {
        especie,
        tamanio,
        color,
        tieneCollar,
        descripcion,
        fotoUri: foto.uri,
        fotoAncho: foto.width,
        ubicacion,
        vistoEn: hace(HORAS_POR_CUANDO[cuando]),
      },
      {
        onSuccess: (animalId) => {
          router.replace(`/animal/${animalId}`);
        },
      },
    );
  };

  return (
    <Pantalla scroll>
      <Texto variante="titulo">{t.publicar.titulo}</Texto>
      <Texto variante="secundario">{t.publicar.intro}</Texto>

      <SelectorFoto foto={foto} onCambio={setFoto} error={errorFoto} />

      <Seccion titulo={t.publicar.especie}>
        <Chips opciones={OPCIONES_ESPECIE} valor={especie} onCambio={setEspecie} />
      </Seccion>

      <Seccion titulo={t.publicar.tamanio}>
        <Chips opciones={OPCIONES_TAMANIO} valor={tamanio} onCambio={setTamanio} />
      </Seccion>

      <CampoTexto
        etiqueta={t.publicar.color}
        placeholder={t.publicar.colorPlaceholder}
        value={color}
        onChangeText={setColor}
        maxLength={80}
      />

      <Interruptor etiqueta={t.publicar.collar} valor={tieneCollar} onCambio={setTieneCollar} />

      <CampoTexto
        etiqueta={t.publicar.descripcion}
        placeholder={t.publicar.descripcionPlaceholder}
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        maxLength={1000}
      />

      <Seccion titulo={t.publicar.cuando}>
        <Chips opciones={OPCIONES_CUANDO} valor={cuando} onCambio={setCuando} />
      </Seccion>

      <Seccion titulo={t.publicar.ubicacion}>
        <View style={estilos.filaBotones}>
          <Boton
            titulo={t.publicar.usarGps}
            icono="locate"
            variante="secundario"
            cargando={buscandoGps}
            onPress={() => void usarGps()}
            style={estilos.botonMitad}
          />
          <Boton
            titulo={t.publicar.elegirMapa}
            icono="map"
            variante="secundario"
            onPress={() => setEligiendoEnMapa(true)}
            style={estilos.botonMitad}
          />
        </View>
        {ubicacion ? (
          <View style={estilos.ubicacionOk}>
            <Ionicons name="checkmark-circle" size={18} color={Colores.exito} />
            <Texto variante="secundario">
              {t.publicar.ubicacionMarcada} · {ubicacion[1].toFixed(5)}, {ubicacion[0].toFixed(5)}
            </Texto>
          </View>
        ) : null}
        {errorUbicacion ? (
          <Texto variante="pequeno" style={estilos.error}>
            {errorUbicacion}
          </Texto>
        ) : null}
        {avisoGps ? <Mensaje texto={avisoGps} /> : null}
      </Seccion>

      {publicar.isError ? (
        <Mensaje texto={publicar.error.message || t.comunes.errorGenerico} tipo="error" />
      ) : null}

      <Boton
        titulo={publicar.isPending ? t.publicar.publicando : t.publicar.publicar}
        icono="paper-plane"
        cargando={publicar.isPending}
        onPress={enviar}
      />

      <SelectorUbicacion
        visible={eligiendoEnMapa}
        inicial={ubicacion}
        onConfirmar={(punto) => {
          setUbicacion(punto);
          setEligiendoEnMapa(false);
        }}
        onCancelar={() => setEligiendoEnMapa(false)}
      />
    </Pantalla>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={estilos.seccion}>
      <Texto variante="secundario" style={estilos.seccionTitulo}>
        {titulo}
      </Texto>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Espacio.s },
  seccionTitulo: { fontWeight: '600' },
  filaBotones: { flexDirection: 'row', gap: Espacio.s },
  botonMitad: { flex: 1 },
  ubicacionOk: { flexDirection: 'row', alignItems: 'center', gap: Espacio.xs },
  error: { color: Colores.peligro },
});

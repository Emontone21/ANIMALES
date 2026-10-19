import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { CampoUbicacion } from '@/components/reportes/CampoUbicacion';
import { ElegirTipoReporte } from '@/components/reportes/ElegirTipoReporte';
import {
  type Cuando,
  type CuandoPerdido,
  fechaDe,
  fechaPerdidoDe,
  SelectorCuando,
  SelectorCuandoPerdido,
} from '@/components/reportes/SelectorCuando';
import { type FotoElegida, SelectorFoto } from '@/components/reportes/SelectorFoto';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Chips } from '@/components/ui/Chips';
import { Interruptor } from '@/components/ui/Interruptor';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Seccion } from '@/components/ui/Seccion';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicarAnimal } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import {
  ESPECIES,
  type Especie,
  type LngLat,
  TAMANIOS,
  type Tamanio,
  type TipoReporte,
} from '@/types/dominio';

const OPCIONES_ESPECIE = ESPECIES.map((valor) => ({ valor, etiqueta: t.especie[valor] }));

const OPCIONES_TAMANIO = TAMANIOS.map((valor) => ({ valor, etiqueta: t.tamanio[valor] }));

const OPCIONES_TIPO: { valor: TipoReporte; etiqueta: string; punto: TipoReporte }[] = [
  { valor: 'perdido', etiqueta: t.publicar.tipos.perdido.titulo, punto: 'perdido' },
  { valor: 'encontrado', etiqueta: t.publicar.tipos.encontrado.titulo, punto: 'encontrado' },
];

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

  // Primero se elige qué pasó; hasta entonces no hay formulario.
  const [tipo, setTipo] = useState<TipoReporte | null>(null);
  const [foto, setFoto] = useState<FotoElegida | null>(null);
  const [especie, setEspecie] = useState<Especie>('perro');
  const [nombre, setNombre] = useState('');
  const [tamanio, setTamanio] = useState<Tamanio | null>(null);
  const [color, setColor] = useState('');
  const [tieneCollar, setTieneCollar] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [cuando, setCuando] = useState<Cuando>('ahora');
  const [cuandoPerdido, setCuandoPerdido] = useState<CuandoPerdido>('hoy');
  const [ubicacion, setUbicacion] = useState<LngLat | null>(null);
  const [contactoFamilia, setContactoFamilia] = useState('');
  const [intentado, setIntentado] = useState(false);

  const errorFoto = intentado && !foto ? t.publicar.fotoObligatoria : null;
  const errorUbicacion = intentado && !ubicacion ? t.publicar.ubicacionFaltante : null;

  if (!tipo) {
    return (
      <Pantalla scroll ancho={AnchoMaximo.formulario}>
        <Texto variante="titulo" accessibilityRole="header">
          {t.publicar.titulo}
        </Texto>
        <ElegirTipoReporte onElegir={setTipo} />
      </Pantalla>
    );
  }

  const perdido = tipo === 'perdido';

  const enviar = () => {
    setIntentado(true);
    if (!foto || !ubicacion) return;

    publicar.mutate(
      {
        tipo,
        especie,
        nombre,
        contactoFamilia,
        tamanio,
        color,
        tieneCollar,
        descripcion,
        fotoUri: foto.uri,
        fotoAncho: foto.width,
        ubicacion,
        vistoEn: perdido ? fechaPerdidoDe(cuandoPerdido) : fechaDe(cuando),
      },
      {
        onSuccess: (animalId) => {
          router.replace(`/animal/${animalId}`);
        },
      },
    );
  };

  return (
    <Pantalla
      scroll
      ancho={AnchoMaximo.formulario}
      pie={
        <View style={{ gap: Espacio.s }}>
          {publicar.isError ? (
            <Mensaje texto={publicar.error.message || t.comunes.errorGenerico} tipo="error" />
          ) : null}
          <Boton
            titulo={publicar.isPending ? t.publicar.publicando : t.publicar.publicar}
            icono="paper-plane-outline"
            cargando={publicar.isPending}
            onPress={enviar}
          />
        </View>
      }>
      <Texto variante="titulo" accessibilityRole="header">
        {t.publicar.titulo}
      </Texto>
      <Chips
        opciones={OPCIONES_TIPO}
        valor={tipo}
        onCambio={setTipo}
        accessibilityLabel={t.mapa.filtros.tipo}
      />
      <Texto variante="secundario">{perdido ? t.publicar.introPerdido : t.publicar.intro}</Texto>

      <SelectorFoto foto={foto} onCambio={setFoto} error={errorFoto} />

      <Seccion titulo={t.publicar.especie}>
        <Chips opciones={OPCIONES_ESPECIE} valor={especie} onCambio={setEspecie} />
      </Seccion>

      {perdido ? (
        <CampoTexto
          etiqueta={t.publicar.nombre}
          placeholder={t.publicar.nombrePlaceholder}
          value={nombre}
          onChangeText={setNombre}
          maxLength={40}
        />
      ) : null}

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
        etiqueta={perdido ? t.publicar.senas : t.publicar.descripcion}
        placeholder={perdido ? t.publicar.senasPlaceholder : t.publicar.descripcionPlaceholder}
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        maxLength={1000}
      />

      {perdido ? (
        <Seccion titulo={t.publicar.cuandoPerdido}>
          <SelectorCuandoPerdido valor={cuandoPerdido} onCambio={setCuandoPerdido} />
        </Seccion>
      ) : (
        <Seccion titulo={t.publicar.cuando}>
          <SelectorCuando valor={cuando} onCambio={setCuando} />
        </Seccion>
      )}

      <Seccion titulo={perdido ? t.publicar.ubicacionPerdido : t.publicar.ubicacion}>
        <CampoUbicacion
          valor={ubicacion}
          onCambio={setUbicacion}
          error={errorUbicacion}
          ayuda={perdido ? t.publicar.ubicacionPerdidoAyuda : undefined}
        />
      </Seccion>

      {perdido ? (
        <CampoTexto
          etiqueta={t.publicar.contactoFamilia}
          placeholder={t.publicar.contactoFamiliaPlaceholder}
          ayuda={t.publicar.contactoFamiliaAyuda}
          value={contactoFamilia}
          onChangeText={setContactoFamilia}
          maxLength={200}
        />
      ) : null}
    </Pantalla>
  );
}

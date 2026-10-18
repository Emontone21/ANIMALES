import { useRouter } from 'expo-router';
import { useState } from 'react';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { CampoUbicacion } from '@/components/reportes/CampoUbicacion';
import { type Cuando, fechaDe, SelectorCuando } from '@/components/reportes/SelectorCuando';
import { type FotoElegida, SelectorFoto } from '@/components/reportes/SelectorFoto';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Chips } from '@/components/ui/Chips';
import { Interruptor } from '@/components/ui/Interruptor';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Seccion } from '@/components/ui/Seccion';
import { Texto } from '@/components/ui/Texto';
import { ColorEspecie } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicarAnimal } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { ESPECIES, type Especie, type LngLat, TAMANIOS, type Tamanio } from '@/types/dominio';

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
  const [intentado, setIntentado] = useState(false);

  const errorFoto = intentado && !foto ? t.publicar.fotoObligatoria : null;
  const errorUbicacion = intentado && !ubicacion ? t.publicar.ubicacionFaltante : null;

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
        vistoEn: fechaDe(cuando),
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
        <SelectorCuando valor={cuando} onCambio={setCuando} />
      </Seccion>

      <Seccion titulo={t.publicar.ubicacion}>
        <CampoUbicacion valor={ubicacion} onCambio={setUbicacion} error={errorUbicacion} />
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
    </Pantalla>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { RequiereTerminos } from '@/components/legal/RequiereTerminos';
import { CampoContactoFamilia, CamposAnimal } from '@/components/reportes/CamposAnimal';
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
import { Chips } from '@/components/ui/Chips';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Seccion } from '@/components/ui/Seccion';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicarAnimal } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import type { CambiosReporte, LngLat, TipoReporte } from '@/types/dominio';

const DATOS_INICIALES: CambiosReporte = {
  especie: 'perro',
  nombre: '',
  contactoFamilia: '',
  tamanio: null,
  color: '',
  tieneCollar: false,
  descripcion: '',
};

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
  return (
    <RequiereTerminos usuarioId={usuario.id} titulo={t.publicar.titulo}>
      <FormularioPublicar usuarioId={usuario.id} />
    </RequiereTerminos>
  );
}

function FormularioPublicar({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const publicar = usePublicarAnimal(usuarioId);

  // Primero se elige qué pasó; hasta entonces no hay formulario.
  const [tipo, setTipo] = useState<TipoReporte | null>(null);
  const [foto, setFoto] = useState<FotoElegida | null>(null);
  // Los datos del animal (especie, nombre, tamaño, color, collar, descripción y contacto).
  const [datos, setDatos] = useState<CambiosReporte>(DATOS_INICIALES);
  const [cuando, setCuando] = useState<Cuando>('ahora');
  const [cuandoPerdido, setCuandoPerdido] = useState<CuandoPerdido>('hoy');
  const [ubicacion, setUbicacion] = useState<LngLat | null>(null);
  const [intentado, setIntentado] = useState(false);
  const cambiarDatos = (cambios: Partial<CambiosReporte>) =>
    setDatos((anteriores) => ({ ...anteriores, ...cambios }));

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
        ...datos,
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
            <Mensaje texto={mensajeDeError(publicar.error)} tipo="error" />
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

      <CamposAnimal tipo={tipo} valores={datos} onCambio={cambiarDatos} />

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
        <CampoContactoFamilia
          valor={datos.contactoFamilia}
          onCambio={(contactoFamilia) => cambiarDatos({ contactoFamilia })}
        />
      ) : null}
    </Pantalla>
  );
}

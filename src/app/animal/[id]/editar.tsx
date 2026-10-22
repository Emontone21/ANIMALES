import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { RequiereTerminos } from '@/components/legal/RequiereTerminos';
import { CampoContactoFamilia, CamposAnimal } from '@/components/reportes/CamposAnimal';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAnimal, useEditarReporte } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import type { AnimalDetalle, CambiosReporte } from '@/types/dominio';

/**
 * Detalle › Más opciones › Editar el reporte. Solo quien lo publicó corrige los
 * datos del animal; el tipo, la ubicación y las fotos quedan como están.
 */
export default function PantallaEditarReporte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, cargando } = useAuth();
  const animal = useAnimal(id);

  if (cargando || animal.isPending) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando />
      </Pantalla>
    );
  }
  if (!usuario) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <RequiereCuenta mensaje={t.editarReporte.soloQuienPublico} />
      </Pantalla>
    );
  }
  if (animal.isError || !animal.data) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.formulario}>
        <Mensaje
          texto={mensajeDeError(animal.error, t.animal.noDisponible)}
          tipo={animal.isError ? 'error' : 'info'}
        />
      </Pantalla>
    );
  }
  // La base también lo exige; acá se explica en vez de mostrar un formulario que fallaría.
  if (animal.data.creado_por !== usuario.id || animal.data.estado === 'vinculado') {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.formulario}>
        <Mensaje
          texto={
            animal.data.estado === 'vinculado'
              ? t.editarReporte.unido
              : t.editarReporte.soloQuienPublico
          }
        />
      </Pantalla>
    );
  }

  return (
    <RequiereTerminos usuarioId={usuario.id} titulo={t.editarReporte.titulo}>
      <FormularioEditar animal={animal.data} />
    </RequiereTerminos>
  );
}

function FormularioEditar({ animal }: { animal: AnimalDetalle }) {
  const router = useRouter();
  const editar = useEditarReporte(animal);
  const [datos, setDatos] = useState<CambiosReporte>({
    especie: animal.especie,
    nombre: animal.nombre ?? '',
    contactoFamilia: animal.contacto_familia ?? '',
    tamanio: animal.tamanio,
    color: animal.color ?? '',
    tieneCollar: animal.tiene_collar ?? false,
    descripcion: animal.descripcion ?? '',
  });
  const cambiar = (cambios: Partial<CambiosReporte>) =>
    setDatos((anteriores) => ({ ...anteriores, ...cambios }));
  const perdido = animal.tipo_reporte === 'perdido';

  const volver = () =>
    router.canGoBack() ? router.back() : router.replace(`/animal/${animal.id}`);

  return (
    <Pantalla
      scroll
      bordes={['left', 'right']}
      ancho={AnchoMaximo.formulario}
      pie={
        <View style={{ gap: Espacio.s }}>
          {editar.isError ? <Mensaje texto={mensajeDeError(editar.error)} tipo="error" /> : null}
          <Boton
            titulo={editar.isPending ? t.editarReporte.guardando : t.editarReporte.guardar}
            icono="checkmark-outline"
            cargando={editar.isPending}
            onPress={() => editar.mutate(datos, { onSuccess: volver })}
          />
        </View>
      }>
      <View style={{ flexDirection: 'row' }}>
        <EtiquetaEstado estado={animal.estado} tipo={animal.tipo_reporte} />
      </View>
      <Texto variante="secundario">{t.editarReporte.intro}</Texto>

      <CamposAnimal tipo={animal.tipo_reporte} valores={datos} onCambio={cambiar} />
      {perdido ? (
        <CampoContactoFamilia
          valor={datos.contactoFamilia}
          onCambio={(contactoFamilia) => cambiar({ contactoFamilia })}
        />
      ) : null}
    </Pantalla>
  );
}

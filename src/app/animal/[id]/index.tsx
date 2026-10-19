import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { AvisoCaso, DetalleCaso } from '@/components/reportes/DetalleCaso';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import {
  armarHistorial,
  useAnimal,
  useAvistamientos,
  useCambiosEstado,
} from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

export default function PantallaAnimal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const animal = useAnimal(id);
  const avistamientos = useAvistamientos(id);
  const cambios = useCambiosEstado(id);

  // Un reporte vinculado redirige al caso principal.
  const vinculadoA = animal.data?.estado === 'vinculado' ? animal.data.vinculado_a : null;
  useEffect(() => {
    if (vinculadoA) router.replace(`/animal/${vinculadoA}`);
  }, [vinculadoA, router]);

  const historial = useMemo(
    () => armarHistorial(avistamientos.data ?? [], cambios.data ?? []),
    [avistamientos.data, cambios.data],
  );

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (animal.isPending) return <Cargando />;

  if (animal.isError) {
    return (
      <AvisoCaso onVolver={volver}>
        <Mensaje
          texto={mensajeDeError(animal.error, t.animal.noEncontrado)}
          tipo="error"
          onReintentar={() => void animal.refetch()}
        />
      </AvisoCaso>
    );
  }

  if (!animal.data) {
    return (
      <AvisoCaso onVolver={volver}>
        <Mensaje texto={t.animal.noEncontrado} />
      </AvisoCaso>
    );
  }

  if (vinculadoA) {
    return (
      <AvisoCaso onVolver={volver}>
        <Mensaje texto={t.animal.vinculadoAviso} />
      </AvisoCaso>
    );
  }

  return (
    <DetalleCaso
      animal={animal.data}
      avistamientos={avistamientos.data ?? []}
      cambios={cambios.data ?? []}
      historial={{
        eventos: historial,
        cargando: avistamientos.isPending || cambios.isPending,
        error:
          avistamientos.isError || cambios.isError
            ? mensajeDeError(avistamientos.error ?? cambios.error)
            : null,
        onReintentar: () => {
          void avistamientos.refetch();
          void cambios.refetch();
        },
      }}
      onVolver={volver}
    />
  );
}

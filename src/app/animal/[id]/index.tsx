import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { CasoBasico } from '@/components/reportes/CasoBasico';
import { AvisoCaso, DetalleCaso } from '@/components/reportes/DetalleCaso';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import {
  armarHistorial,
  useAnimal,
  useAvistamientos,
  useCambiosEstado,
} from '@/features/reportes/api';
import { soloLoBasico } from '@/features/reportes/permisos';
import { esRecienPublicado, olvidarRecienPublicado } from '@/features/reportes/recienPublicado';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

export default function PantallaAnimal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Recién publicado: se pregunta por las notificaciones del celular una sola vez.
  const [recienPublicado] = useState(() => esRecienPublicado(id));
  useEffect(() => olvidarRecienPublicado(id), [id]);
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
  const irAlMapa = <Boton titulo={t.comunes.volverAlMapa} onPress={() => router.replace('/')} />;

  if (animal.isPending) return <Cargando />;

  // Un link roto da error; uno de un caso oculto por moderación o borrado no
  // trae nada (la base no lo deja ver): el mismo texto para los dos.
  if (animal.isError) {
    return (
      <AvisoCaso onVolver={volver}>
        <Mensaje
          texto={mensajeDeError(animal.error, t.animal.noDisponible)}
          tipo="error"
          onReintentar={() => void animal.refetch()}
        />
        {irAlMapa}
      </AvisoCaso>
    );
  }

  if (!animal.data) {
    return (
      <AvisoCaso onVolver={volver}>
        <Mensaje texto={t.animal.noDisponible} />
        {irAlMapa}
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

  // Un caso reunido, para quien no participó: la base manda solo lo básico.
  if (soloLoBasico(animal.data)) return <CasoBasico animal={animal.data} onVolver={volver} />;

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
      onVerMapa={() => router.push(`/animal/${id}/mapa`)}
      ofrecerAvisos={recienPublicado}
    />
  );
}

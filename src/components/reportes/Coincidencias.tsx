import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  otroAnimal,
  perdidoDelPar,
  puedeResolver,
  useCoincidencias,
  useResolverCoincidencia,
} from '@/features/coincidencias/api';
import { usePerfil } from '@/features/perfil/api';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { CoincidenciaDetalle } from '@/types/dominio';

type Props = { animalId: string };

const FOTO = 64;
const SUPERPOSICION = 16;

/**
 * "Posibles coincidencias" (6.10): otros reportes que el reconocimiento de
 * imágenes cree que son el mismo animal. Una persona confirma o rechaza; nunca
 * se une solo. Si el par incluye un perdido decide su familia; entre dos
 * encontrados, quien publicó alguno o un moderador. El resto ve un mensaje de espera.
 */
export function Coincidencias({ animalId }: Props) {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const { usuario } = useAuth();
  const { data: perfil } = usePerfil(usuario?.id);
  const esModerador = perfil?.es_moderador ?? false;
  const coincidencias = useCoincidencias(animalId);
  const resolver = useResolverCoincidencia(animalId);
  const [aviso, setAviso] = useState<string | null>(null);

  if (coincidencias.isPending || coincidencias.isError) return null;

  const pendientes = coincidencias.data.filter((c) => c.estado === 'pendiente');
  const resueltas = coincidencias.data.filter((c) => c.estado !== 'pendiente');

  const resolverCon = (c: CoincidenciaDetalle, confirmada: boolean) => {
    resolver.mutate(
      { id: c.id, confirmada },
      {
        onSuccess: (principal) => {
          if (confirmada && principal && principal !== animalId) {
            router.replace(`/animal/${principal}`);
            return;
          }
          setAviso(confirmada ? t.coincidencias.confirmada : t.coincidencias.rechazada);
        },
      },
    );
  };

  return (
    <View style={estilos.bloque}>
      <Texto variante="tituloTarjeta" accessibilityRole="header">
        {t.coincidencias.titulo}
      </Texto>
      {pendientes.length === 0 && resueltas.length === 0 ? (
        <Texto variante="secundario">{t.coincidencias.vacio}</Texto>
      ) : (
        <Texto variante="secundario">{t.coincidencias.intro}</Texto>
      )}
      {aviso ? <Mensaje texto={aviso} tipo="exito" /> : null}
      {resolver.isError ? (
        <Mensaje texto={resolver.error.message || t.comunes.errorGenerico} tipo="error" />
      ) : null}

      {pendientes.map((c) => {
        const otro = otroAnimal(c, animalId);
        const propia = c.animal_origen === animalId ? c.origen_foto_path : c.candidato_foto_path;
        const porcentaje = Math.round(c.similitud * 100);
        const km = c.distancia_m === null ? null : c.distancia_m / 1000;
        const decide = puedeResolver(c, usuario?.id, esModerador);
        const perdido = perdidoDelPar(c);
        return (
          <View key={c.id} style={estilos.coincidencia}>
            <View style={estilos.encabezado}>
              <View
                style={estilos.fotos}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                <FotoMiniatura
                  ruta={propia}
                  style={estilos.foto}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
                <FotoMiniatura
                  ruta={otro.fotoPath}
                  style={[estilos.foto, estilos.fotoSuperpuesta]}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              </View>
              <Texto style={estilos.resumen}>
                {t.coincidencias.resumen(otro.especie, otro.tipo, otro.nombre, km, porcentaje)}
                {c.horas_diferencia !== null
                  ? ` ${t.coincidencias.tiempoOracion(c.horas_diferencia)}`
                  : ''}
              </Texto>
            </View>
            {decide ? null : (
              <Mensaje
                texto={
                  !perdido.hayPerdido
                    ? t.coincidencias.esperaPublicadores
                    : perdido.familia
                      ? t.coincidencias.esperaFamilia
                      : t.coincidencias.sinFamilia
                }
              />
            )}
            <View style={estilos.botones}>
              {decide ? (
                <>
                  <Boton
                    titulo={t.coincidencias.esElMismo}
                    icono="checkmark-outline"
                    cargando={resolver.isPending && resolver.variables?.id === c.id}
                    deshabilitado={resolver.isPending}
                    onPress={() => resolverCon(c, true)}
                  />
                  <Boton
                    titulo={t.coincidencias.noEsElMismo}
                    icono="close-outline"
                    variante="secundario"
                    deshabilitado={resolver.isPending}
                    onPress={() => resolverCon(c, false)}
                  />
                </>
              ) : null}
              <Boton
                titulo={t.coincidencias.verOtro}
                variante="suave"
                onPress={() => router.push(`/animal/${otro.id}`)}
              />
            </View>
          </View>
        );
      })}

      {resueltas.length > 0 ? (
        <Texto variante="pequeno">{t.coincidencias.resueltas(resueltas.length)}</Texto>
      ) : null}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  bloque: {
    gap: Espacio.sm,
    padding: 18,
    borderRadius: Radio.xl,
    backgroundColor: c.coincidenciaFondo,
  },
  coincidencia: { gap: Espacio.sm, marginTop: Espacio.xs },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: Espacio.sm },
  fotos: { flexDirection: 'row' },
  foto: {
    width: FOTO,
    height: FOTO,
    borderRadius: FOTO / 2,
    borderWidth: 3,
    borderColor: c.coincidenciaFondo,
    backgroundColor: c.superficieSuave,
  },
  fotoSuperpuesta: { marginLeft: -SUPERPOSICION },
  resumen: { flex: 1 },
  botones: { gap: Espacio.s },
}));

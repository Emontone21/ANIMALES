import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAbrirConversacion } from '@/features/mensajes/api';
import { t } from '@/i18n/es-UY';

type Props = { animalId: string; otroUsuarioId: string; titulo: string };

/** Abre (o retoma) la conversación con otro usuario sobre este animal. */
export function BotonEscribir({ animalId, otroUsuarioId, titulo }: Props) {
  const router = useRouter();
  const { usuario } = useAuth();
  const abrir = useAbrirConversacion();
  const [error, setError] = useState<string | null>(null);

  // Sin cuenta, o si soy yo mismo, no hay a quién escribirle.
  if (!usuario || usuario.id === otroUsuarioId) return null;

  return (
    <View>
      <Boton
        titulo={titulo}
        icono="chatbubble-ellipses"
        variante="secundario"
        cargando={abrir.isPending}
        onPress={() => {
          setError(null);
          abrir.mutate(
            { animalId, otroUsuarioId },
            {
              onSuccess: (id) => router.push({ pathname: '/conversacion/[id]', params: { id } }),
              onError: (e) => setError(e.message || t.comunes.errorGenerico),
            },
          );
        }}
      />
      {error ? <Mensaje texto={error} tipo="error" /> : null}
    </View>
  );
}

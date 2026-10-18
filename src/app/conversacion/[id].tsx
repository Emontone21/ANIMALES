import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  clavesMensajes,
  marcarLeidos,
  useConversacion,
  useEnviarMensaje,
  useMensajes,
} from '@/features/mensajes/api';
import { t } from '@/i18n/es-UY';
import { fechaHoraCorta } from '@/lib/fechas';
import { useQueryClient } from '@tanstack/react-query';

export default function PantallaConversacion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, cargando } = useAuth();

  if (cargando) return <Cargando />;
  if (!usuario) {
    return (
      <Pantalla>
        <RequiereCuenta mensaje={t.mensajes.requiereCuenta} />
      </Pantalla>
    );
  }
  return <Chat conversacionId={id} miId={usuario.id} />;
}

function Chat({ conversacionId, miId }: { conversacionId: string; miId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const conversacion = useConversacion(conversacionId);
  const mensajes = useMensajes(conversacionId);
  const enviar = useEnviarMensaje(conversacionId, miId);
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Al ver mensajes ajenos sin leer, marcarlos.
  const hayNoLeidos = mensajes.data?.some((m) => m.emisor_id !== miId && !m.leido_en) ?? false;
  useEffect(() => {
    if (!hayNoLeidos) return;
    marcarLeidos(conversacionId, miId)
      .then(() => queryClient.invalidateQueries({ queryKey: clavesMensajes.conversaciones }))
      .catch(() => {});
  }, [hayNoLeidos, conversacionId, miId, queryClient]);

  const cantidad = mensajes.data?.length ?? 0;
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [cantidad]);

  const mandar = () => {
    const cuerpo = texto.trim();
    if (!cuerpo) return;
    enviar.mutate(cuerpo, { onSuccess: () => setTexto('') });
  };

  return (
    <SafeAreaView style={estilos.raiz} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: conversacion.data?.otro_nombre ?? t.mensajes.titulo,
          headerRight: () =>
            conversacion.data ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.mensajes.verReporte}
                onPress={() => router.push(`/animal/${conversacion.data?.animal_id}`)}
                hitSlop={8}>
                <Ionicons name="paw" size={22} color={Colores.primario} />
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView
        style={estilos.raiz}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        {mensajes.isPending ? (
          <Cargando />
        ) : mensajes.isError ? (
          <View style={estilos.relleno}>
            <Mensaje
              texto={mensajes.error.message}
              tipo="error"
              onReintentar={() => void mensajes.refetch()}
            />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={estilos.lista}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            <Mensaje texto={t.mensajes.aviso} />
            {mensajes.data.length === 0 ? (
              <Texto variante="secundario" style={estilos.centrado}>
                {t.mensajes.vacio}
              </Texto>
            ) : null}
            {mensajes.data.map((m) => {
              const mio = m.emisor_id === miId;
              return (
                <View key={m.id} style={[estilos.burbuja, mio ? estilos.mia : estilos.ajena]}>
                  <Texto style={mio ? estilos.textoMio : undefined}>{m.cuerpo}</Texto>
                  <Texto variante="pequeno" style={mio ? estilos.horaMia : undefined}>
                    {fechaHoraCorta(m.created_at)}
                  </Texto>
                </View>
              );
            })}
          </ScrollView>
        )}

        {enviar.isError ? (
          <View style={estilos.relleno}>
            <Mensaje texto={enviar.error.message || t.comunes.errorGenerico} tipo="error" />
          </View>
        ) : null}

        <View style={estilos.entrada}>
          <TextInput
            style={estilos.input}
            placeholder={t.mensajes.placeholder}
            placeholderTextColor={Colores.textoSecundario}
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={2000}
            onSubmitEditing={mandar}
            blurOnSubmit
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.mensajes.enviar}
            onPress={mandar}
            disabled={enviar.isPending || texto.trim() === ''}
            style={({ pressed }) => [
              estilos.botonEnviar,
              (pressed || enviar.isPending || texto.trim() === '') && estilos.botonEnviarInactivo,
            ]}>
            <Ionicons name="send" size={20} color={Colores.textoInvertido} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colores.fondo },
  relleno: { padding: Espacio.m },
  lista: { padding: Espacio.m, gap: Espacio.s },
  centrado: { textAlign: 'center' },
  burbuja: {
    maxWidth: '80%',
    padding: Espacio.m,
    borderRadius: Radio.l,
    gap: 2,
  },
  mia: { alignSelf: 'flex-end', backgroundColor: Colores.primario, borderBottomRightRadius: 4 },
  ajena: {
    alignSelf: 'flex-start',
    backgroundColor: Colores.fondoSuave,
    borderBottomLeftRadius: 4,
  },
  textoMio: { color: Colores.textoInvertido },
  horaMia: { color: Colores.primarioSuave },
  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Espacio.s,
    padding: Espacio.m,
    borderTopWidth: 1,
    borderTopColor: Colores.borde,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s,
    borderWidth: 1,
    borderColor: Colores.borde,
    borderRadius: Radio.l,
    fontSize: 16,
    color: Colores.texto,
  },
  botonEnviar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.primario,
  },
  botonEnviarInactivo: { opacity: 0.5 },
});

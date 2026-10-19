import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { estaActivo } from '@/components/ui/interaccion';
import { AnchoMaximo, Espacio, Fuentes, Medida, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  clavesMensajes,
  marcarLeidos,
  useConversacion,
  useEnviarMensaje,
  useMensajes,
} from '@/features/mensajes/api';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
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
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const queryClient = useQueryClient();
  const conversacion = useConversacion(conversacionId);
  const mensajes = useMensajes(conversacionId);
  const enviar = useEnviarMensaje(conversacionId, miId);
  const [texto, setTexto] = useState('');
  const [enfocado, setEnfocado] = useState(false);
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
                style={estilos.verReporte}>
                <Ionicons name="paw-outline" size={22} color={c.primario} />
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
            <Texto variante="secundario" style={estilos.aviso}>
              {t.mensajes.aviso}
            </Texto>
            {mensajes.data.length === 0 ? (
              <Texto variante="secundario" style={estilos.centrado}>
                {t.mensajes.vacio}
              </Texto>
            ) : null}
            {mensajes.data.map((m) => {
              const mio = m.emisor_id === miId;
              return (
                <View key={m.id} style={[estilos.burbuja, mio ? estilos.mia : estilos.ajena]}>
                  <Texto color={mio ? 'textoSobrePrimario' : 'texto'} selectable>
                    {m.cuerpo}
                  </Texto>
                  <Texto variante="pequeno" color={mio ? 'textoSobrePrimario' : 'textoSecundario'}>
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

        <View style={estilos.barraEntrada}>
          <View style={estilos.entrada}>
            <TextInput
              style={[estilos.input, enfocado && estilos.inputFoco]}
              placeholder={t.mensajes.placeholder}
              placeholderTextColor={c.textoSecundario}
              accessibilityLabel={t.mensajes.placeholder}
              value={texto}
              onChangeText={setTexto}
              onFocus={() => setEnfocado(true)}
              onBlur={() => setEnfocado(false)}
              multiline
              // En web un textarea arranca con dos filas: la cápsula es de una (52 de alto).
              rows={Platform.OS === 'web' ? 1 : undefined}
              maxLength={2000}
              onSubmitEditing={mandar}
              submitBehavior="blurAndSubmit"
              cursorColor={c.primario}
              selectionColor={c.primario}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.mensajes.enviar}
              onPress={mandar}
              disabled={enviar.isPending || texto.trim() === ''}
              style={(estado) => [
                estilos.botonEnviar,
                estaActivo(estado) && estilos.botonEnviarActivo,
                (enviar.isPending || texto.trim() === '') && estilos.botonEnviarInactivo,
              ]}>
              <Ionicons name="send-outline" size={20} color={c.textoSobrePrimario} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.fondo },
  relleno: { padding: Espacio.m, width: '100%', maxWidth: AnchoMaximo.lista, alignSelf: 'center' },
  lista: {
    padding: Espacio.m,
    gap: Espacio.s,
    width: '100%',
    maxWidth: AnchoMaximo.lista,
    alignSelf: 'center',
  },
  centrado: { textAlign: 'center' },
  aviso: { textAlign: 'center', marginBottom: Espacio.s },
  burbuja: {
    maxWidth: '80%',
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.sm - 2,
    borderRadius: 20,
    gap: 2,
  },
  mia: { alignSelf: 'flex-end', backgroundColor: c.primario, borderBottomRightRadius: 6 },
  ajena: { alignSelf: 'flex-start', backgroundColor: c.superficieSuave, borderBottomLeftRadius: 6 },
  barraEntrada: {
    borderTopWidth: 1,
    borderTopColor: c.borde,
    backgroundColor: c.superficie,
  },
  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Espacio.s,
    padding: Espacio.sm,
    width: '100%',
    maxWidth: AnchoMaximo.lista,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: Medida.campo,
    maxHeight: 120,
    paddingHorizontal: Espacio.ml,
    paddingTop: 15,
    paddingBottom: 15,
    borderWidth: 1,
    borderColor: c.borde,
    borderRadius: Medida.campo / 2,
    backgroundColor: c.superficie,
    ...Fuentes.regular,
    fontSize: 16,
    lineHeight: 20,
    color: c.texto,
  },
  inputFoco: { borderWidth: 2, borderColor: c.primario, paddingHorizontal: Espacio.ml - 1 },
  botonEnviar: {
    width: Medida.areaTactil,
    height: Medida.areaTactil,
    marginBottom: (Medida.campo - Medida.areaTactil) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: c.primario,
  },
  botonEnviarActivo: { backgroundColor: c.primarioPresionado },
  botonEnviarInactivo: { opacity: 0.45 },
  verReporte: {
    width: Medida.areaTactil,
    height: Medida.areaTactil,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
  },
}));

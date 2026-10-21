import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
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
import { HojaTerminos } from '@/components/legal/AceptarTerminos';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { MenuOpciones } from '@/components/ui/MenuOpciones';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { estaActivo } from '@/components/ui/interaccion';
import { AnchoMaximo, Espacio, Fuentes, Medida, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAlternarBloqueo } from '@/features/bloqueos/api';
import { useTerminos } from '@/features/legal/terminos';
import {
  anotarLeidos,
  clavesMensajes,
  marcarLeidos,
  useConversacion,
  useEnviarMensaje,
  useMensajes,
} from '@/features/mensajes/api';
import { casoDisponible } from '@/features/mensajes/casoDisponible';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
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
  // Si otra pantalla la tapa (por ejemplo, el caso), deja de pedir mensajes.
  const enFoco = useIsFocused();
  const mensajes = useMensajes(conversacionId, enFoco);
  const enviar = useEnviarMensaje(conversacionId, miId);
  const terminos = useTerminos(miId);
  const alternarBloqueo = useAlternarBloqueo(miId);
  const [texto, setTexto] = useState('');
  const [enfocado, setEnfocado] = useState(false);
  const [menu, setMenu] = useState<'opciones' | 'bloquear' | 'terminos' | null>(null);
  const otro = conversacion.data;
  const nombreOtro = otro?.otro_nombre ?? t.mensajes.titulo;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Al ver mensajes ajenos sin leer, marcarlos.
  const hayNoLeidos = mensajes.data?.some((m) => m.emisor_id !== miId && !m.leido_en) ?? false;
  useEffect(() => {
    if (!hayNoLeidos) return;
    marcarLeidos(conversacionId, miId)
      .then(() => {
        anotarLeidos(queryClient, conversacionId, miId);
        return queryClient.invalidateQueries({ queryKey: clavesMensajes.conversaciones });
      })
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

  const alternar = () => {
    if (!otro) return;
    alternarBloqueo.mutate(
      { otroId: otro.otro_id, bloqueado: otro.bloqueaste },
      { onSuccess: () => setMenu(null) },
    );
  };

  // Qué va abajo en lugar de la entrada de texto, si no se puede escribir.
  const sinEntrada = otro?.bloqueaste ? (
    <View style={estilos.estadoEntrada}>
      <Mensaje texto={t.bloqueos.bloqueaste(nombreOtro)} />
      <Boton
        titulo={t.bloqueos.desbloquear(nombreOtro)}
        variante="secundario"
        cargando={alternarBloqueo.isPending}
        onPress={alternar}
      />
    </View>
  ) : otro?.bloqueada ? (
    <View style={estilos.estadoEntrada}>
      <Mensaje texto={t.bloqueos.noPodes} />
    </View>
  ) : !terminos.cargando && !terminos.aceptados ? (
    <View style={estilos.estadoEntrada}>
      <Mensaje texto={t.mensajes.aceptarParaEscribir} />
      <Boton
        titulo={t.mensajes.verYAceptar}
        variante="secundario"
        onPress={() => setMenu('terminos')}
      />
    </View>
  ) : null;

  return (
    <SafeAreaView style={estilos.raiz} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: nombreOtro,
          headerRight: () =>
            otro ? (
              <View style={estilos.accionesCabecera}>
                {casoDisponible(otro) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.mensajes.verReporte}
                    onPress={() => router.push(`/animal/${otro.animal_id}`)}
                    style={(estado) => [estilos.verReporte, estaActivo(estado) && estilos.activo]}>
                    <Ionicons name="paw-outline" size={22} color={c.primario} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.mensajes.masOpciones}
                  onPress={() => setMenu('opciones')}
                  style={(estado) => [estilos.verReporte, estaActivo(estado) && estilos.activo]}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={c.texto} />
                </Pressable>
              </View>
            ) : null,
        }}
      />
      {otro ? (
        <>
          <MenuOpciones
            visible={menu === 'opciones'}
            titulo={t.mensajes.masOpciones}
            error={alternarBloqueo.isError ? mensajeDeError(alternarBloqueo.error) : null}
            onCerrar={() => setMenu(null)}
            opciones={[
              otro.bloqueaste
                ? {
                    titulo: t.bloqueos.desbloquear(nombreOtro),
                    icono: 'person-add-outline',
                    cargando: alternarBloqueo.isPending,
                    onPress: alternar,
                  }
                : {
                    titulo: t.bloqueos.bloquear(nombreOtro),
                    icono: 'ban-outline',
                    variante: 'peligro',
                    onPress: () => setMenu('bloquear'),
                  },
            ]}
          />
          <MenuOpciones
            visible={menu === 'bloquear'}
            titulo={t.bloqueos.confirmarTitulo(nombreOtro)}
            descripcion={t.bloqueos.confirmarDetalle}
            error={alternarBloqueo.isError ? mensajeDeError(alternarBloqueo.error) : null}
            onCerrar={() => setMenu(null)}
            opciones={[
              {
                titulo: t.bloqueos.confirmar,
                icono: 'ban-outline',
                variante: 'peligro',
                cargando: alternarBloqueo.isPending,
                onPress: alternar,
              },
            ]}
          />
        </>
      ) : null}
      <HojaTerminos
        visible={menu === 'terminos'}
        usuarioId={miId}
        onCerrar={() => setMenu(null)}
        onAceptado={() => setMenu(null)}
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
              texto={mensajeDeError(mensajes.error)}
              tipo="error"
              onReintentar={() => void mensajes.refetch()}
            />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={estilos.lista}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            {/* Caso oculto por moderación: en lugar del caso, el aviso. */}
            {otro && !casoDisponible(otro) ? (
              <View style={estilos.noDisponible}>
                <Texto variante="cuerpoFuerte">{t.mensajes.publicacionNoDisponible}</Texto>
                <Mensaje texto={t.mensajes.publicacionOcultada} tipo="error" />
              </View>
            ) : null}
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
            <Mensaje texto={mensajeDeError(enviar.error)} tipo="error" />
          </View>
        ) : null}

        <View style={estilos.barraEntrada}>
          {sinEntrada ?? (
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
          )}
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
  noDisponible: { gap: Espacio.s, marginBottom: Espacio.s },
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
    borderColor: c.bordeCampo,
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
  activo: { backgroundColor: c.superficieSuave },
  accionesCabecera: { flexDirection: 'row', alignItems: 'center' },
  estadoEntrada: {
    gap: Espacio.s,
    padding: Espacio.sm,
    width: '100%',
    maxWidth: AnchoMaximo.lista,
    alignSelf: 'center',
  },
}));

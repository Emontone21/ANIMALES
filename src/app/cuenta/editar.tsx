import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActualizarPerfil, usePerfil } from '@/features/perfil/api';
import { type FotoElegida, useElegirFoto } from '@/hooks/useElegirFoto';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { Perfil } from '@/types/dominio';

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 40;

/** Perfil › Editar perfil: nombre público y foto. */
export default function PantallaEditarPerfil() {
  const { usuario } = useAuth();
  const perfil = usePerfil(usuario?.id);

  if (perfil.isPending) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando />
      </Pantalla>
    );
  }
  if (perfil.isError || !perfil.data) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.formulario}>
        <Mensaje
          texto={perfil.error?.message ?? t.comunes.errorGenerico}
          tipo="error"
          onReintentar={() => void perfil.refetch()}
        />
      </Pantalla>
    );
  }
  return <Editor perfil={perfil.data} />;
}

function Editor({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const actualizar = useActualizarPerfil(perfil);
  const [nombre, setNombre] = useState(perfil.nombre_publico);
  // undefined: la foto no cambia · null: se quita · FotoElegida: una nueva.
  const [foto, setFoto] = useState<FotoElegida | null | undefined>(undefined);
  const [intentado, setIntentado] = useState(false);
  // En el celular se puede recortar cuadrada; en web el navegador no lo ofrece.
  const elegir = useElegirFoto(setFoto, { allowsEditing: true, aspect: [1, 1] });

  const largo = nombre.trim().length;
  const nombreValido = largo >= NOMBRE_MIN && largo <= NOMBRE_MAX;
  const fotoActual = foto === undefined ? perfil.avatar_path : null;
  const tieneFoto = Boolean(foto || fotoActual);

  const guardar = () => {
    setIntentado(true);
    if (!nombreValido) return;
    actualizar.mutate(
      { nombre, foto: foto ? { uri: foto.uri, width: foto.width } : foto },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Pantalla
      scroll
      bordes={['left', 'right']}
      ancho={AnchoMaximo.formulario}
      pie={
        <View style={estilos.pie}>
          {actualizar.isError ? (
            <Mensaje texto={actualizar.error.message || t.comunes.errorGenerico} tipo="error" />
          ) : null}
          <Boton
            titulo={t.cuenta.editar.guardar}
            icono="checkmark-outline"
            cargando={actualizar.isPending}
            onPress={guardar}
          />
        </View>
      }>
      <View style={estilos.foto}>
        <Texto variante="etiquetaCampo">{t.cuenta.editar.foto}</Texto>
        <View style={estilos.filaFoto}>
          <Avatar nombre={nombre} fotoPath={fotoActual} fotoUri={foto?.uri} tamanio={96} />
          <View style={estilos.botonesFoto}>
            <Boton
              titulo={t.publicar.sacarFoto}
              icono="camera-outline"
              variante="secundario"
              onPress={() => void elegir.sacarFoto()}
            />
            <Boton
              titulo={t.publicar.elegirGaleria}
              icono="images-outline"
              variante="secundario"
              onPress={() => void elegir.elegirDeGaleria()}
            />
            {tieneFoto ? (
              <Boton
                titulo={t.cuenta.editar.quitarFoto}
                icono="trash-outline"
                variante="peligro"
                onPress={() => setFoto(null)}
              />
            ) : null}
          </View>
        </View>
        <Texto variante="pequeno">{t.cuenta.editar.fotoAyuda}</Texto>
        {elegir.aviso ? <Mensaje texto={elegir.aviso} tipo="info" /> : null}
      </View>

      <CampoTexto
        etiqueta={t.auth.nombre}
        placeholder={t.auth.nombrePlaceholder}
        ayuda={t.cuenta.editar.nombreAyuda}
        error={intentado && !nombreValido ? t.cuenta.editar.nombreInvalido : null}
        value={nombre}
        onChangeText={setNombre}
        autoComplete="name"
        maxLength={NOMBRE_MAX}
      />
    </Pantalla>
  );
}

const crear = crearEstilos(() => ({
  pie: { gap: Espacio.s },
  foto: { gap: Espacio.s },
  filaFoto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espacio.m },
  botonesFoto: { flex: 1, minWidth: 220, gap: Espacio.s },
}));

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ModalAvistamiento } from '@/components/reportes/ModalAvistamiento';
import { ModalDenuncia } from '@/components/reportes/ModalDenuncia';
import { ModalEstado, type TipoCambio } from '@/components/reportes/ModalEstado';
import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Espacio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDenuncia } from '@/features/denuncias/api';
import { useSeguimiento } from '@/features/seguimientos/api';
import { t } from '@/i18n/es-UY';
import type { AnimalDetalle } from '@/types/dominio';

type Props = { animal: AnimalDetalle };

type Modal = 'avistamiento' | 'denuncia' | TipoCambio | null;

/** Botonera del detalle: lo vi, resguardar, reunido/reabrir, seguir, denunciar. */
export function AccionesAnimal({ animal }: Props) {
  const router = useRouter();
  const { usuario } = useAuth();
  const [modal, setModal] = useState<Modal>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const seguimiento = useSeguimiento(usuario?.id, animal.id);
  const denuncia = useDenuncia(usuario?.id, animal.id);

  if (!usuario) {
    return (
      <View style={estilos.contenedor}>
        <Mensaje texto={t.animal.requiereCuentaAcciones} />
        <View style={estilos.fila}>
          <Boton
            titulo={t.auth.ingresar}
            onPress={() => router.push('/auth/ingresar')}
            style={estilos.mitad}
          />
          <Boton
            titulo={t.auth.registrarse}
            variante="secundario"
            onPress={() => router.push('/auth/registrarse')}
            style={estilos.mitad}
          />
        </View>
      </View>
    );
  }

  const abierto = animal.estado === 'avistado' || animal.estado === 'resguardado';
  const esCreador = animal.creado_por === usuario.id;

  const cerrarConAviso = (texto: string) => {
    setModal(null);
    setAviso(texto);
  };

  return (
    <View style={estilos.contenedor}>
      {aviso ? <Mensaje texto={aviso} tipo="exito" /> : null}

      {abierto ? (
        <Boton
          titulo={t.animal.acciones.loVi}
          icono="eye"
          onPress={() => setModal('avistamiento')}
        />
      ) : null}

      <View style={estilos.fila}>
        {animal.estado === 'avistado' ? (
          <Boton
            titulo={t.animal.acciones.resguardar}
            icono="home"
            variante="secundario"
            onPress={() => setModal('resguardar')}
            style={estilos.mitad}
          />
        ) : null}
        {animal.estado === 'resguardado' ? (
          <Boton
            titulo={t.animal.acciones.reabrir}
            icono="refresh"
            variante="secundario"
            onPress={() => setModal('reabrir')}
            style={estilos.mitad}
          />
        ) : null}
        {abierto ? (
          <Boton
            titulo={t.animal.acciones.reunido}
            icono="heart"
            variante="secundario"
            onPress={() => setModal('reunido')}
            style={estilos.mitad}
          />
        ) : null}
        {animal.estado === 'reunido' && esCreador ? (
          <Boton
            titulo={t.animal.acciones.reabrir}
            icono="refresh"
            variante="secundario"
            onPress={() => setModal('reabrir')}
            style={estilos.mitad}
          />
        ) : null}
      </View>

      <View style={estilos.fila}>
        <Boton
          titulo={seguimiento.sigue ? t.animal.acciones.siguiendo : t.animal.acciones.seguir}
          icono={seguimiento.sigue ? 'notifications' : 'notifications-outline'}
          variante={seguimiento.sigue ? 'secundario' : 'fantasma'}
          cargando={seguimiento.alternar.isPending}
          onPress={() => seguimiento.alternar.mutate()}
          style={estilos.mitad}
        />
        <Boton
          titulo={denuncia.yaDenuncio ? t.animal.acciones.denunciado : t.animal.acciones.denunciar}
          icono="flag-outline"
          variante="fantasma"
          deshabilitado={denuncia.yaDenuncio}
          onPress={() => setModal('denuncia')}
          style={estilos.mitad}
        />
      </View>

      <ModalAvistamiento
        visible={modal === 'avistamiento'}
        animalId={animal.id}
        usuarioId={usuario.id}
        onCerrar={() => setModal(null)}
        onExito={() => cerrarConAviso(t.animal.modalAvistamiento.exito)}
      />
      {modal === 'resguardar' || modal === 'reunido' || modal === 'reabrir' ? (
        <ModalEstado
          visible
          tipo={modal}
          animalId={animal.id}
          onCerrar={() => setModal(null)}
          onExito={() => cerrarConAviso(t.comunes.listo)}
        />
      ) : null}
      <ModalDenuncia
        visible={modal === 'denuncia'}
        animalId={animal.id}
        usuarioId={usuario.id}
        onCerrar={() => setModal(null)}
        onExito={() => cerrarConAviso(t.animal.modalDenuncia.exito)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Espacio.s },
  fila: { flexDirection: 'row', gap: Espacio.s, flexWrap: 'wrap' },
  mitad: { flex: 1, minWidth: 150 },
});

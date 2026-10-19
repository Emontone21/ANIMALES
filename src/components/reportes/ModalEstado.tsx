import { useState } from 'react';

import { CampoUbicacion } from '@/components/reportes/CampoUbicacion';
import { type FotoElegida, SelectorFoto } from '@/components/reportes/SelectorFoto';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Hoja } from '@/components/ui/Hoja';
import { Mensaje } from '@/components/ui/Mensaje';
import { Seccion } from '@/components/ui/Seccion';
import { useCambiarEstado } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import type { LngLat, TipoReporte } from '@/types/dominio';

/** Qué cambio de estado está pidiendo el usuario. */
export type TipoCambio = 'resguardar' | 'reunido' | 'reabrir';

type Props = {
  visible: boolean;
  tipo: TipoCambio;
  animalId: string;
  /** En un perdido, resguardarlo pide una foto actual y el contacto es privado. */
  tipoReporte: TipoReporte;
  usuarioId: string;
  onCerrar: () => void;
  onExito: () => void;
};

const TEXTOS = {
  resguardar: t.animal.modalResguardo,
  reunido: t.animal.modalReunido,
  reabrir: t.animal.modalReabrir,
} as const;

/**
 * Resguardado (con contacto opcional), reunido con su familia, o reabrir el
 * caso. Resguardar un perdido pide además una foto actual: es lo que le
 * permite a la familia reconocerlo y frena a quien dice tenerlo para pedir plata.
 */
export function ModalEstado({
  visible,
  tipo,
  animalId,
  tipoReporte,
  usuarioId,
  onCerrar,
  onExito,
}: Props) {
  const cambiar = useCambiarEstado(usuarioId);
  const [contacto, setContacto] = useState('');
  const [nota, setNota] = useState('');
  const [ubicacion, setUbicacion] = useState<LngLat | null>(null);
  const [foto, setFoto] = useState<FotoElegida | null>(null);
  const [intentado, setIntentado] = useState(false);
  const textos = TEXTOS[tipo];
  const resguardaPerdido = tipo === 'resguardar' && tipoReporte === 'perdido';
  const errorFoto =
    resguardaPerdido && intentado && !foto ? t.animal.modalResguardo.fotoObligatoria : null;

  const reiniciar = () => {
    setContacto('');
    setNota('');
    setUbicacion(null);
    setFoto(null);
    setIntentado(false);
    cambiar.reset();
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  const enviar = () => {
    setIntentado(true);
    if (resguardaPerdido && !foto) return;
    cambiar.mutate(
      {
        animalId,
        estadoNuevo:
          tipo === 'resguardar' ? 'resguardado' : tipo === 'reunido' ? 'reunido' : 'avistado',
        contactoCompartido: tipo === 'resguardar' ? contacto : undefined,
        nota,
        ubicacion: tipo === 'resguardar' ? ubicacion : null,
        fotoUri: tipo === 'resguardar' ? foto?.uri : null,
        fotoAncho: foto?.width,
      },
      {
        onSuccess: () => {
          reiniciar();
          onExito();
        },
      },
    );
  };

  return (
    <Hoja
      visible={visible}
      titulo={textos.titulo}
      intro={resguardaPerdido ? t.animal.modalResguardo.introPerdido : textos.intro}
      onCerrar={cerrar}
      pie={
        <Boton
          titulo={textos.enviar}
          icono={
            tipo === 'resguardar'
              ? 'home-outline'
              : tipo === 'reunido'
                ? 'heart-outline'
                : 'refresh-outline'
          }
          cargando={cambiar.isPending}
          onPress={enviar}
        />
      }>
      {resguardaPerdido ? (
        <SelectorFoto
          foto={foto}
          onCambio={setFoto}
          error={errorFoto}
          etiqueta={t.animal.modalResguardo.foto}
        />
      ) : null}
      {tipo === 'resguardar' ? (
        <>
          <CampoTexto
            etiqueta={t.animal.modalResguardo.contacto}
            placeholder={t.animal.modalResguardo.contactoPlaceholder}
            ayuda={resguardaPerdido ? t.animal.modalResguardo.contactoAyudaPerdido : undefined}
            value={contacto}
            onChangeText={setContacto}
            maxLength={200}
          />
          <Seccion titulo={t.animal.modalResguardo.ubicacion}>
            <CampoUbicacion
              valor={ubicacion}
              onCambio={setUbicacion}
              ayuda={t.animal.modalResguardo.ubicacionAyuda}
            />
          </Seccion>
        </>
      ) : null}
      {tipo !== 'reabrir' ? (
        <CampoTexto
          etiqueta={
            tipo === 'resguardar' ? t.animal.modalResguardo.nota : t.animal.modalReunido.nota
          }
          placeholder={
            tipo === 'resguardar'
              ? t.animal.modalResguardo.notaPlaceholder
              : t.animal.modalReunido.notaPlaceholder
          }
          ayuda={resguardaPerdido ? t.animal.modalResguardo.notaAyudaPerdido : undefined}
          value={nota}
          onChangeText={setNota}
          multiline
          maxLength={500}
        />
      ) : null}
      {cambiar.isError ? <Mensaje texto={mensajeDeError(cambiar.error)} tipo="error" /> : null}
    </Hoja>
  );
}

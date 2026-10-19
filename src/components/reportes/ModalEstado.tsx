import { useState } from 'react';

import { CampoUbicacion } from '@/components/reportes/CampoUbicacion';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Hoja } from '@/components/ui/Hoja';
import { Mensaje } from '@/components/ui/Mensaje';
import { Seccion } from '@/components/ui/Seccion';
import { useCambiarEstado } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import type { LngLat } from '@/types/dominio';

/** Qué cambio de estado está pidiendo el usuario. */
export type TipoCambio = 'resguardar' | 'reunido' | 'reabrir';

type Props = {
  visible: boolean;
  tipo: TipoCambio;
  animalId: string;
  onCerrar: () => void;
  onExito: () => void;
};

const TEXTOS = {
  resguardar: t.animal.modalResguardo,
  reunido: t.animal.modalReunido,
  reabrir: t.animal.modalReabrir,
} as const;

/** Resguardado (con contacto opcional), reunido con su familia, o reabrir el caso. */
export function ModalEstado({ visible, tipo, animalId, onCerrar, onExito }: Props) {
  const cambiar = useCambiarEstado();
  const [contacto, setContacto] = useState('');
  const [nota, setNota] = useState('');
  const [ubicacion, setUbicacion] = useState<LngLat | null>(null);
  const textos = TEXTOS[tipo];

  const reiniciar = () => {
    setContacto('');
    setNota('');
    setUbicacion(null);
    cambiar.reset();
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  const enviar = () => {
    cambiar.mutate(
      {
        animalId,
        estadoNuevo:
          tipo === 'resguardar' ? 'resguardado' : tipo === 'reunido' ? 'reunido' : 'avistado',
        contactoCompartido: tipo === 'resguardar' ? contacto : undefined,
        nota,
        ubicacion: tipo === 'resguardar' ? ubicacion : null,
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
      intro={textos.intro}
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
      {tipo === 'resguardar' ? (
        <>
          <CampoTexto
            etiqueta={t.animal.modalResguardo.contacto}
            placeholder={t.animal.modalResguardo.contactoPlaceholder}
            value={contacto}
            onChangeText={setContacto}
            maxLength={200}
          />
          <Seccion titulo={t.animal.modalResguardo.ubicacion}>
            <CampoUbicacion valor={ubicacion} onCambio={setUbicacion} />
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
          value={nota}
          onChangeText={setNota}
          multiline
          maxLength={500}
        />
      ) : null}
      {cambiar.isError ? (
        <Mensaje texto={cambiar.error.message || t.comunes.errorGenerico} tipo="error" />
      ) : null}
    </Hoja>
  );
}

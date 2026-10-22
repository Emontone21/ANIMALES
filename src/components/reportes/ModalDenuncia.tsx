import { useState } from 'react';

import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Chips } from '@/components/ui/Chips';
import { Hoja } from '@/components/ui/Hoja';
import { Mensaje } from '@/components/ui/Mensaje';
import { Seccion } from '@/components/ui/Seccion';
import { useDenunciar } from '@/features/denuncias/denunciar';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { type MotivoDenuncia, MOTIVOS_DENUNCIA } from '@/types/dominio';

type Props = {
  visible: boolean;
  animalId: string;
  usuarioId: string;
  /** La historia del reencuentro del caso, no el caso. */
  historia?: boolean;
  onCerrar: () => void;
  onExito: () => void;
};

const OPCIONES = MOTIVOS_DENUNCIA.map((valor) => ({
  valor,
  etiqueta: t.motivoDenuncia[valor],
}));

/**
 * Denunciar una publicación inapropiada, o la historia de su reencuentro. Va
 * en un bloque aparte: el detalle del caso y el muro la cargan al tocar
 * "Denunciar".
 */
export default function ModalDenuncia({
  visible,
  animalId,
  usuarioId,
  historia = false,
  onCerrar,
  onExito,
}: Props) {
  const enviar = useDenunciar(usuarioId);
  const [motivo, setMotivo] = useState<MotivoDenuncia>('contenido_inapropiado');
  const [detalle, setDetalle] = useState('');

  const cerrar = () => {
    enviar.reset();
    onCerrar();
  };

  return (
    <Hoja
      visible={visible}
      titulo={historia ? t.reencuentros.denunciaTitulo : t.animal.modalDenuncia.titulo}
      intro={historia ? t.reencuentros.denunciaIntro : t.animal.modalDenuncia.intro}
      onCerrar={cerrar}
      pie={
        <Boton
          titulo={t.animal.modalDenuncia.enviar}
          icono="flag-outline"
          variante="peligro"
          cargando={enviar.isPending}
          onPress={() =>
            enviar.mutate(
              { animalId, motivo, detalle, historia },
              {
                onSuccess: () => {
                  setDetalle('');
                  onExito();
                },
              },
            )
          }
        />
      }>
      <Seccion titulo={t.animal.modalDenuncia.motivo}>
        <Chips opciones={OPCIONES} valor={motivo} onCambio={setMotivo} />
      </Seccion>
      <CampoTexto
        etiqueta={t.animal.modalDenuncia.detalle}
        placeholder={t.animal.modalDenuncia.detallePlaceholder}
        value={detalle}
        onChangeText={setDetalle}
        multiline
        maxLength={500}
      />
      {enviar.isError ? <Mensaje texto={mensajeDeError(enviar.error)} tipo="error" /> : null}
    </Hoja>
  );
}

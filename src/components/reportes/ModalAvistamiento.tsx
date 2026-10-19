import { useState } from 'react';

import { CampoUbicacion } from '@/components/reportes/CampoUbicacion';
import { type Cuando, fechaDe, SelectorCuando } from '@/components/reportes/SelectorCuando';
import { type FotoElegida, SelectorFoto } from '@/components/reportes/SelectorFoto';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Hoja } from '@/components/ui/Hoja';
import { Mensaje } from '@/components/ui/Mensaje';
import { Seccion } from '@/components/ui/Seccion';
import { useRegistrarAvistamiento } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import type { LngLat } from '@/types/dominio';

type Props = {
  visible: boolean;
  animalId: string;
  usuarioId: string;
  onCerrar: () => void;
  onExito: () => void;
};

/** "Lo vi acá también": foto, cuándo, dónde y nota opcional. */
export function ModalAvistamiento({ visible, animalId, usuarioId, onCerrar, onExito }: Props) {
  const registrar = useRegistrarAvistamiento(usuarioId);
  const [foto, setFoto] = useState<FotoElegida | null>(null);
  const [cuando, setCuando] = useState<Cuando>('ahora');
  const [ubicacion, setUbicacion] = useState<LngLat | null>(null);
  const [nota, setNota] = useState('');
  const [intentado, setIntentado] = useState(false);

  const errorFoto = intentado && !foto ? t.publicar.fotoObligatoria : null;
  const errorUbicacion = intentado && !ubicacion ? t.publicar.ubicacionFaltante : null;

  const reiniciar = () => {
    setFoto(null);
    setCuando('ahora');
    setUbicacion(null);
    setNota('');
    setIntentado(false);
    registrar.reset();
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  const enviar = () => {
    setIntentado(true);
    if (!foto || !ubicacion) return;
    registrar.mutate(
      {
        animalId,
        fotoUri: foto.uri,
        fotoAncho: foto.width,
        ubicacion,
        vistoEn: fechaDe(cuando),
        nota,
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
      titulo={t.animal.modalAvistamiento.titulo}
      onCerrar={cerrar}
      pie={
        <Boton
          titulo={t.animal.modalAvistamiento.enviar}
          icono="eye-outline"
          cargando={registrar.isPending}
          onPress={enviar}
        />
      }>
      <SelectorFoto foto={foto} onCambio={setFoto} error={errorFoto} />
      <Seccion titulo={t.publicar.cuando}>
        <SelectorCuando valor={cuando} onCambio={setCuando} />
      </Seccion>
      <Seccion titulo={t.publicar.ubicacion}>
        <CampoUbicacion valor={ubicacion} onCambio={setUbicacion} error={errorUbicacion} />
      </Seccion>
      <CampoTexto
        etiqueta={t.animal.modalAvistamiento.nota}
        placeholder={t.animal.modalAvistamiento.notaPlaceholder}
        value={nota}
        onChangeText={setNota}
        multiline
        maxLength={500}
      />
      {registrar.isError ? <Mensaje texto={mensajeDeError(registrar.error)} tipo="error" /> : null}
    </Hoja>
  );
}

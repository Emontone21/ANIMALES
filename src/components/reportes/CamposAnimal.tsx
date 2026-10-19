import { CampoTexto } from '@/components/ui/CampoTexto';
import { Chips } from '@/components/ui/Chips';
import { Interruptor } from '@/components/ui/Interruptor';
import { Seccion } from '@/components/ui/Seccion';
import { t } from '@/i18n/es-UY';
import { type CambiosReporte, ESPECIES, TAMANIOS, type TipoReporte } from '@/types/dominio';

const OPCIONES_ESPECIE = ESPECIES.map((valor) => ({ valor, etiqueta: t.especie[valor] }));

const OPCIONES_TAMANIO = TAMANIOS.map((valor) => ({ valor, etiqueta: t.tamanio[valor] }));

type Props = {
  tipo: TipoReporte;
  valores: CambiosReporte;
  onCambio: (cambios: Partial<CambiosReporte>) => void;
};

/**
 * Los datos del animal, iguales al publicar y al editar: especie, nombre (solo
 * en perdidos), tamaño, color, collar y descripción. El contacto de la familia
 * va aparte (CampoContactoFamilia): al publicar queda al final del formulario.
 */
export function CamposAnimal({ tipo, valores, onCambio }: Props) {
  const perdido = tipo === 'perdido';
  return (
    <>
      <Seccion titulo={t.publicar.especie}>
        <Chips
          opciones={OPCIONES_ESPECIE}
          valor={valores.especie}
          onCambio={(especie) => onCambio({ especie })}
        />
      </Seccion>

      {perdido ? (
        <CampoTexto
          etiqueta={t.publicar.nombre}
          placeholder={t.publicar.nombrePlaceholder}
          value={valores.nombre}
          onChangeText={(nombre) => onCambio({ nombre })}
          maxLength={40}
        />
      ) : null}

      <Seccion titulo={t.publicar.tamanio}>
        <Chips
          opciones={OPCIONES_TAMANIO}
          valor={valores.tamanio}
          onCambio={(tamanio) => onCambio({ tamanio })}
        />
      </Seccion>

      <CampoTexto
        etiqueta={t.publicar.color}
        placeholder={t.publicar.colorPlaceholder}
        value={valores.color}
        onChangeText={(color) => onCambio({ color })}
        maxLength={80}
      />

      <Interruptor
        etiqueta={t.publicar.collar}
        valor={valores.tieneCollar}
        onCambio={(tieneCollar) => onCambio({ tieneCollar })}
      />

      <CampoTexto
        etiqueta={perdido ? t.publicar.senas : t.publicar.descripcion}
        placeholder={perdido ? t.publicar.senasPlaceholder : t.publicar.descripcionPlaceholder}
        value={valores.descripcion}
        onChangeText={(descripcion) => onCambio({ descripcion })}
        multiline
        maxLength={1000}
      />
    </>
  );
}

/** El dato que la familia de un perdido elige mostrar. */
export function CampoContactoFamilia({
  valor,
  onCambio,
}: {
  valor: string;
  onCambio: (contactoFamilia: string) => void;
}) {
  return (
    <CampoTexto
      etiqueta={t.publicar.contactoFamilia}
      placeholder={t.publicar.contactoFamiliaPlaceholder}
      ayuda={t.publicar.contactoFamiliaAyuda}
      value={valor}
      onChangeText={onCambio}
      maxLength={200}
    />
  );
}

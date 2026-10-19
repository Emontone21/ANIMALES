import { useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Medida, Radio, Tipografia } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

export type CampoTextoProps = TextInputProps & {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
};

/** Campo con etiqueta arriba, ayuda y error (6.15). */
export function CampoTexto({
  etiqueta,
  ayuda,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: CampoTextoProps) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const [conFoco, setConFoco] = useState(false);

  return (
    <View style={estilos.contenedor}>
      <Texto variante="etiquetaCampo">{etiqueta}</Texto>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={c.textoSecundario}
        selectionColor={c.primario}
        onFocus={(e) => {
          setConFoco(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setConFoco(false);
          onBlur?.(e);
        }}
        style={[
          estilos.input,
          props.multiline && estilos.multilinea,
          conFoco && estilos.conFoco,
          error ? estilos.conError : null,
          style,
        ]}
        {...props}
      />
      {error ? (
        <Texto variante="pequeno" color="peligro">
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto variante="pequeno">{ayuda}</Texto>
      ) : null}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  contenedor: { gap: Espacio.s },
  input: {
    ...Tipografia.cuerpo,
    minHeight: Medida.campo,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.sm,
    borderWidth: 1,
    borderColor: c.borde,
    borderRadius: Radio.m,
    backgroundColor: c.superficie,
    color: c.texto,
  },
  multilinea: { minHeight: 112, textAlignVertical: 'top' },
  // El borde crece 1 px: se compensa en el relleno para que el texto no salte.
  conFoco: { borderWidth: 2, borderColor: c.primario, paddingHorizontal: Espacio.m - 1 },
  conError: { borderColor: c.peligro },
}));

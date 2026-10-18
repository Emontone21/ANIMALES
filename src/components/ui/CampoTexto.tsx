import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';

export type CampoTextoProps = TextInputProps & {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
};

/** Input con etiqueta, texto de ayuda y error. */
export function CampoTexto({ etiqueta, ayuda, error, style, ...props }: CampoTextoProps) {
  return (
    <View style={estilos.contenedor}>
      <Texto variante="secundario" style={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      <TextInput
        placeholderTextColor={Colores.textoSecundario}
        style={[
          estilos.input,
          props.multiline && estilos.multilinea,
          error && estilos.conError,
          style,
        ]}
        {...props}
      />
      {error ? (
        <Texto variante="pequeno" style={estilos.error}>
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto variante="pequeno">{ayuda}</Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Espacio.xs },
  etiqueta: { fontWeight: '600' },
  input: {
    minHeight: 48,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s,
    borderWidth: 1,
    borderColor: Colores.borde,
    borderRadius: Radio.m,
    backgroundColor: Colores.fondo,
    fontSize: 16,
    color: Colores.texto,
  },
  multilinea: { minHeight: 96, textAlignVertical: 'top' },
  conError: { borderColor: Colores.peligro },
  error: { color: Colores.peligro },
});

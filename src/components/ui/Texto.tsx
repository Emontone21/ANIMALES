import { Text, type TextProps } from 'react-native';

import { ColorTexto, type Paleta, Tipografia, type VarianteTexto } from '@/constants/tema';
import { useTema } from '@/hooks/useTema';

export type TextoProps = TextProps & {
  variante?: VarianteTexto;
  /** Color de la paleta; por defecto, el de la variante. */
  color?: keyof Paleta;
};

/** Texto con la escala tipográfica del tema y el color del esquema activo. */
export function Texto({ variante = 'cuerpo', color, style, ...props }: TextoProps) {
  const { c } = useTema();
  return (
    <Text
      style={[Tipografia[variante], { color: c[color ?? ColorTexto[variante]] }, style]}
      {...props}
    />
  );
}

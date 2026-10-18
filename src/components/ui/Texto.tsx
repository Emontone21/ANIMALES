import { Text, type TextProps } from 'react-native';

import { Tipografia } from '@/constants/tema';

type Variante = keyof typeof Tipografia;

export type TextoProps = TextProps & { variante?: Variante };

/** Texto con las variantes tipográficas del tema. */
export function Texto({ variante = 'cuerpo', style, ...props }: TextoProps) {
  return <Text style={[Tipografia[variante], style]} {...props} />;
}

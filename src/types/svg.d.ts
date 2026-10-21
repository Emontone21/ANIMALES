// Los SVG de assets/ son recursos de Metro, como las imágenes: un número en
// nativo y { uri, width, height } en web. Se muestran con expo-image.
declare module '*.svg' {
  import type { ImageSource } from 'expo-image';

  const recurso: number | ImageSource;
  export default recurso;
}

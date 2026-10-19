import {
  type ComponentRef,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';

type Desplazable = ComponentRef<typeof ScrollView>;

type Props = Omit<ScrollViewProps, 'horizontal'> & {
  children: ReactNode;
  ref?: Ref<Desplazable>;
};

/**
 * Fila con desplazamiento lateral (chips, carrusel). En web también se mueve
 * con la rueda del mouse: el giro vertical se traduce a horizontal.
 */
export function DesplazableHorizontal({ children, ref: refExterna, ...props }: Props) {
  const ref = useRef<Desplazable>(null);
  // El handle se crea después de montar, cuando la ref interna ya está asignada.
  useImperativeHandle(refExterna, () => ref.current as Desplazable, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const nodo = ref.current?.getScrollableNode() as HTMLElement | null | undefined;
    if (!nodo) return;
    const alGirar = (evento: WheelEvent) => {
      if (Math.abs(evento.deltaX) >= Math.abs(evento.deltaY)) return;
      if (nodo.scrollWidth <= nodo.clientWidth) return;
      nodo.scrollLeft += evento.deltaY;
      evento.preventDefault();
    };
    nodo.addEventListener('wheel', alGirar, { passive: false });
    return () => nodo.removeEventListener('wheel', alGirar);
  }, []);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} {...props}>
      {children}
    </ScrollView>
  );
}

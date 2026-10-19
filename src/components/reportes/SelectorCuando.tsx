import { Chips } from '@/components/ui/Chips';
import { t } from '@/i18n/es-UY';
import { hace } from '@/lib/fechas';

export type Cuando = keyof typeof t.publicar.cuandoOpciones;
export type CuandoPerdido = keyof typeof t.publicar.cuandoPerdidoOpciones;

const HORAS_POR_CUANDO: Record<Cuando, number> = {
  ahora: 0,
  hace1h: 1,
  hace3h: 3,
  hoy: 8,
  ayer: 24,
};

/** Un perdido se cuenta en días: alcanza con saber más o menos desde cuándo lo buscan. */
const HORAS_POR_CUANDO_PERDIDO: Record<CuandoPerdido, number> = {
  hoy: 0,
  ayer: 24,
  hace2d: 48,
  hace3d: 72,
  semana: 24 * 7,
  dosSemanas: 24 * 14,
};

const OPCIONES = (Object.keys(HORAS_POR_CUANDO) as Cuando[]).map((valor) => ({
  valor,
  etiqueta: t.publicar.cuandoOpciones[valor],
}));

const OPCIONES_PERDIDO = (Object.keys(HORAS_POR_CUANDO_PERDIDO) as CuandoPerdido[]).map(
  (valor) => ({ valor, etiqueta: t.publicar.cuandoPerdidoOpciones[valor] }),
);

/** Convierte la opción elegida en una fecha concreta. */
export function fechaDe(cuando: Cuando, ahora: Date = new Date()): Date {
  return hace(HORAS_POR_CUANDO[cuando], ahora);
}

/** Lo mismo para "¿Cuándo se perdió?". */
export function fechaPerdidoDe(cuando: CuandoPerdido, ahora: Date = new Date()): Date {
  return hace(HORAS_POR_CUANDO_PERDIDO[cuando], ahora);
}

type Props = { valor: Cuando; onCambio: (valor: Cuando) => void };

/** "¿Cuándo lo viste?" con opciones rápidas en vez de un selector de fecha. */
export function SelectorCuando({ valor, onCambio }: Props) {
  return <Chips opciones={OPCIONES} valor={valor} onCambio={onCambio} />;
}

type PropsPerdido = { valor: CuandoPerdido; onCambio: (valor: CuandoPerdido) => void };

/** "¿Cuándo se perdió?" en días: hoy, ayer… hasta hace dos semanas, sin fecha exacta. */
export function SelectorCuandoPerdido({ valor, onCambio }: PropsPerdido) {
  return <Chips opciones={OPCIONES_PERDIDO} valor={valor} onCambio={onCambio} />;
}

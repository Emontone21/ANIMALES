import { Chips } from '@/components/ui/Chips';
import { t } from '@/i18n/es-UY';
import { hace } from '@/lib/fechas';

export type Cuando = keyof typeof t.publicar.cuandoOpciones;

const HORAS_POR_CUANDO: Record<Cuando, number> = {
  ahora: 0,
  hace1h: 1,
  hace3h: 3,
  hoy: 8,
  ayer: 24,
};

const OPCIONES = (Object.keys(HORAS_POR_CUANDO) as Cuando[]).map((valor) => ({
  valor,
  etiqueta: t.publicar.cuandoOpciones[valor],
}));

/** Convierte la opción elegida en una fecha concreta. */
export function fechaDe(cuando: Cuando, ahora: Date = new Date()): Date {
  return hace(HORAS_POR_CUANDO[cuando], ahora);
}

type Props = { valor: Cuando; onCambio: (valor: Cuando) => void };

/** "¿Cuándo lo viste?" con opciones rápidas en vez de un selector de fecha. */
export function SelectorCuando({ valor, onCambio }: Props) {
  return <Chips opciones={OPCIONES} valor={valor} onCambio={onCambio} />;
}

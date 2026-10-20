import type { AppConNavegador, FormaDeInstalar } from '@/features/instalar/formaDeInstalar';

/** En la app nativa no se ofrece instalar: ya está instalada. */
export function useInstalar(): {
  forma: FormaDeInstalar;
  app: AppConNavegador | null;
  instalar: () => Promise<void>;
} {
  return { forma: 'ninguna', app: null, instalar: async () => {} };
}

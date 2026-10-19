import type { ReactNode } from 'react';

import { AceptarTerminos } from '@/components/legal/AceptarTerminos';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo } from '@/constants/tema';
import { useTerminos } from '@/features/legal/terminos';
import { t } from '@/i18n/es-UY';

/**
 * Pantalla que pide los términos aceptados (por ejemplo, Publicar): hasta que
 * se aceptan, muestra la aceptación en lugar del contenido.
 */
export function RequiereTerminos({
  usuarioId,
  titulo,
  children,
}: {
  usuarioId: string;
  titulo: string;
  children: ReactNode;
}) {
  const terminos = useTerminos(usuarioId);

  if (terminos.cargando) {
    return (
      <Pantalla>
        <Cargando />
      </Pantalla>
    );
  }
  if (terminos.aceptados) return children;

  return (
    <Pantalla scroll ancho={AnchoMaximo.formulario}>
      <Texto variante="titulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {terminos.error ? (
        <Mensaje
          texto={terminos.error.message || t.comunes.errorGenerico}
          tipo="error"
          onReintentar={terminos.reintentar}
        />
      ) : (
        <AceptarTerminos usuarioId={usuarioId} />
      )}
    </Pantalla>
  );
}

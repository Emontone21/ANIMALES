import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { MarcaAcceso } from '@/components/auth/Acceso';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { AnchoMaximo } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  abrirLinkDeMail,
  pantallaDelLink,
  type ResultadoLinkDeMail,
} from '@/features/auth/linkDeMail';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { linkDeMail } from '@/lib/urlAuth';

type Estado =
  | { fase: 'comprobando' }
  | { fase: 'listo'; resultado: ResultadoLinkDeMail }
  | { fase: 'error'; mensaje: string };

/**
 * El link de los mails de Supabase Auth (?token_hash=…&type=…, ver
 * supabase/templates/). Sirve en cualquier navegador: se canjea acá con
 * verifyOtp (src/features/auth/linkDeMail.ts). Si es de recuperación, el
 * layout lleva a elegir la contraseña nueva.
 */
export default function PantallaConfirmar() {
  const router = useRouter();
  const { usuario } = useAuth();
  const link = linkDeMail(useLocalSearchParams());
  const [estado, setEstado] = useState<Estado>({ fase: 'comprobando' });
  const [intento, setIntento] = useState(0);

  const tokenHash = link?.tokenHash;
  const tipo = link?.tipo;
  useEffect(() => {
    if (!tokenHash || !tipo) return;
    let activo = true;
    abrirLinkDeMail({ tokenHash, tipo }).then(
      (resultado) => activo && setEstado({ fase: 'listo', resultado }),
      (e: unknown) => activo && setEstado({ fase: 'error', mensaje: mensajeDeError(e) }),
    );
    return () => {
      activo = false;
    };
  }, [tokenHash, tipo, intento]);

  const irAlMapa = () => router.replace('/');

  if (!link) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
        <MarcaAcceso />
        <Mensaje texto={t.auth.confirmar.invalido} tipo="error" />
        <Boton titulo={t.auth.nuevaContrasena.irAlMapa} icono="map-outline" onPress={irAlMapa} />
      </Pantalla>
    );
  }

  // Recuperación: el layout ya lleva a /auth/nueva-contrasena.
  if (
    estado.fase === 'comprobando' ||
    (estado.fase === 'listo' && estado.resultado.tipo === 'recuperacion')
  ) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando texto={t.auth.confirmar.comprobando} />
      </Pantalla>
    );
  }

  if (estado.fase === 'error') {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
        <MarcaAcceso />
        <Mensaje texto={estado.mensaje} tipo="error" />
        <Boton
          titulo={t.auth.confirmar.reintentar}
          icono="refresh-outline"
          onPress={() => {
            setEstado({ fase: 'comprobando' });
            setIntento((n) => n + 1);
          }}
        />
      </Pantalla>
    );
  }

  const { resultado } = estado;
  if (resultado.tipo === 'recuperacion') return null;
  const { mensaje, tipo: tipoMensaje, boton } = pantallaDelLink(resultado, !!usuario);
  return (
    <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.acceso}>
      <MarcaAcceso />
      <Mensaje texto={mensaje} tipo={tipoMensaje} />
      {boton === 'ingresar' ? (
        <Boton
          titulo={t.auth.ingresar}
          icono="log-in-outline"
          onPress={() => router.replace('/auth/ingresar')}
        />
      ) : boton === 'recuperar' ? (
        <Boton
          titulo={t.auth.nuevaContrasena.pedirOtro}
          icono="mail-outline"
          onPress={() => router.replace('/auth/recuperar')}
        />
      ) : (
        <Boton titulo={t.auth.nuevaContrasena.irAlMapa} icono="map-outline" onPress={irAlMapa} />
      )}
    </Pantalla>
  );
}

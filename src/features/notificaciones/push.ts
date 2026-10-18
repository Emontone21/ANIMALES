import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AndroidImportance } from 'expo-notifications';

import { registrarPushToken } from '@/features/notificaciones/api';
import type { DatosNotificacion } from '@/types/dominio';

/**
 * Push con Expo Notifications (solo Android/iOS; en web hay un archivo .web.ts
 * que no hace nada). Registra el token del dispositivo en Supabase y, al tocar
 * una notificación, navega a la pantalla que corresponde.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function obtenerToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // los emuladores no reciben push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Novedades',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const actual = await Notifications.getPermissionsAsync();
  let estado = actual.status;
  if (estado !== 'granted') {
    estado = (await Notifications.requestPermissionsAsync()).status;
  }
  if (estado !== 'granted') return null;

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    // Sin proyecto de EAS no hay token de Expo Push; la app sigue funcionando sin push.
    return null;
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** Navega según los datos de la notificación tocada. */
export function destinoDe(datos: DatosNotificacion): Href {
  if (datos.conversacion_id) {
    return { pathname: '/conversacion/[id]', params: { id: datos.conversacion_id } };
  }
  if (datos.animal_id) return { pathname: '/animal/[id]', params: { id: datos.animal_id } };
  return '/actividad';
}

export function usePush(usuarioId: string | null | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (!usuarioId) return;
    let activo = true;
    obtenerToken()
      .then((token) => {
        if (activo && token) {
          return registrarPushToken(usuarioId, token, Platform.OS === 'ios' ? 'ios' : 'android');
        }
      })
      .catch(() => {
        // Sin red o sin permiso: se reintenta en la próxima apertura.
      });
    return () => {
      activo = false;
    };
  }, [usuarioId]);

  useEffect(() => {
    const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      const datos = (respuesta.notification.request.content.data ?? {}) as DatosNotificacion;
      router.push(destinoDe(datos));
    });
    return () => suscripcion.remove();
  }, [router]);
}

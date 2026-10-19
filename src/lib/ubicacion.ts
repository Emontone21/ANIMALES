import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { LngLat } from '@/types/dominio';

/** Centro de Montevideo (Plaza Independencia), [lng, lat]. */
export const MONTEVIDEO: LngLat = [-56.1645, -34.9011];

/** Zoom inicial para ver la ciudad entera. */
export const ZOOM_CIUDAD = 11.5;

/** Zoom para ubicar un punto concreto. */
export const ZOOM_PUNTO = 15;

/** En web, una posición de hace más que esto no sirve: la persona pudo haberse movido. */
const ANTIGUEDAD_MAXIMA_MS = 10_000;
const ESPERA_GPS_MS = 15_000;

/**
 * Pide permiso de ubicación en primer plano y devuelve la posición actual,
 * o null si el usuario no dio permiso, el GPS falló o tardó demasiado.
 */
export async function obtenerPosicionActual(): Promise<LngLat | null> {
  try {
    if (Platform.OS === 'web') return await posicionWeb();
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) return null;
    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return [posicion.coords.longitude, posicion.coords.latitude];
  } catch {
    return null;
  }
}

/**
 * Web: directo al navegador. expo-location pide la posición con antigüedad
 * máxima infinita, así que con la página abierta devuelve la primera que
 * obtuvo (por ejemplo, la de casa) aunque la persona se haya movido. Además
 * usa navigator.permissions, que Safari de iPhone anterior a iOS 16 no tiene.
 * El navegador pide el permiso solo.
 */
function posicionWeb(): Promise<LngLat | null> {
  return new Promise((resolver) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolver(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => resolver([posicion.coords.longitude, posicion.coords.latitude]),
      () => resolver(null),
      { enableHighAccuracy: true, maximumAge: ANTIGUEDAD_MAXIMA_MS, timeout: ESPERA_GPS_MS },
    );
  });
}

/** Distancia aproximada en metros entre dos puntos (haversine). */
export function distanciaMetros(a: LngLat, b: LngLat): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

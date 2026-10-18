import * as Location from 'expo-location';

import type { LngLat } from '@/types/dominio';

/** Centro de Montevideo (Plaza Independencia), [lng, lat]. */
export const MONTEVIDEO: LngLat = [-56.1645, -34.9011];

/** Zoom inicial para ver la ciudad entera. */
export const ZOOM_CIUDAD = 11.5;

/** Zoom para ubicar un punto concreto. */
export const ZOOM_PUNTO = 15;

/**
 * Pide permiso de ubicación en primer plano y devuelve la posición actual,
 * o null si el usuario no dio permiso o el GPS falló.
 */
export async function obtenerPosicionActual(): Promise<LngLat | null> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) return null;

  try {
    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return [posicion.coords.longitude, posicion.coords.latitude];
  } catch {
    return null;
  }
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

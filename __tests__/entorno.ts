/**
 * Variables de entorno de las pruebas: valores de ejemplo, nunca los reales.
 * src/lib/env.ts exige las dos primeras.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'clave-de-prueba';
process.env.EXPO_PUBLIC_SITE_URL = 'https://encontrados.test/';

// AsyncStorage es un módulo nativo: en las pruebas, su versión en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

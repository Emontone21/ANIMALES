import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { ENV } from '@/lib/env';
import type { Database } from '@/types/database';

const esWeb = Platform.OS === 'web';

/**
 * Único cliente de Supabase de la app. Importalo desde acá; no crees otro.
 * La sesión se guarda en AsyncStorage (localStorage en web). En web, Supabase
 * lee solo los tokens que llegan en la URL tras confirmar email u OAuth.
 */
export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: esWeb,
  },
});

// En nativo, refrescar el token solo mientras la app está en primer plano.
if (!esWeb) {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

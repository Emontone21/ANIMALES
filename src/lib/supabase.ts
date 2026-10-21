import '@/lib/polyfills';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { ENV } from '@/lib/env';
import type { Database } from '@/types/database';

const esWeb = Platform.OS === 'web';

/**
 * Único cliente de Supabase de la app. Importalo desde acá; no crees otro.
 * La sesión se guarda en AsyncStorage (localStorage en web).
 *
 * Flujo PKCE: los links de confirmar el email, recuperar la contraseña y
 * Google vuelven con un `?code=` que solo se canjea con el verificador que
 * guardó este navegador al pedirlo. Así un link con tokens ajenos
 * (#access_token=…) no abre una sesión que la persona no pidió (auditoría 2,
 * S-M1). En web, Supabase canjea el código de la URL solo; en nativo, lo hace
 * crearSesionDesdeUrl.
 */
export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
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

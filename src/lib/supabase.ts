import '@/lib/polyfills';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { ENV } from '@/lib/env';
import type { Database } from '@/types/database';

const esWeb = Platform.OS === 'web';

/**
 * El cliente de Supabase de la app. Importalo desde acá; no crees otro (salvo
 * crearClienteDeUnUso, abajo). La sesión se guarda en AsyncStorage
 * (localStorage en web).
 *
 * Flujo PKCE: Google vuelve con un `?code=` que solo se canjea con el
 * verificador que guardó este navegador al pedirlo. Así un link con tokens
 * ajenos (#access_token=…) no abre una sesión que la persona no pidió
 * (auditoría 2, S-M1). En web, Supabase canjea el código de la URL solo; en
 * nativo, lo hace crearSesionDesdeUrl. Los links de los mails no usan el
 * código: van a /auth/confirmar (src/features/auth/linkDeMail.ts).
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

let clientesDeUnUso = 0;

/**
 * Un cliente que guarda la sesión solo en memoria y no lee la URL: para canjear
 * el link de un mail (src/features/auth/linkDeMail.ts). Lo que abre ese link no
 * llega a la sesión de la app hasta que la persona lo decide, y se pierde al
 * recargar. Cada uno con su clave: si no, supabase-js avisa en la consola que
 * hay dos clientes.
 */
export function crearClienteDeUnUso() {
  clientesDeUnUso += 1;
  return createClient<Database>(ENV.supabaseUrl, ENV.supabaseKey, {
    auth: {
      storageKey: `sb-spot-link-de-mail-${clientesDeUnUso}`,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type ClienteDeUnUso = ReturnType<typeof crearClienteDeUnUso>;

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

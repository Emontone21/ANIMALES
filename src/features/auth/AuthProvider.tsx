import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { crearSesionDesdeUrl } from '@/features/auth/acciones';
import { supabase } from '@/lib/supabase';

type ValorAuth = {
  /** null mientras se restaura la sesión guardada. */
  sesion: Session | null;
  usuario: User | null;
  /** true hasta que sabemos si hay sesión guardada. */
  cargando: boolean;
};

const AuthContext = createContext<ValorAuth | null>(null);

/**
 * Mantiene la sesión de Supabase en memoria y la restaura al abrir la app.
 * También procesa los deep links con tokens (confirmación de email, OAuth).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const urlEntrante = Linking.useLinkingURL();

  useEffect(() => {
    let activo = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSesion(data.session);
      setCargando(false);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (!activo) return;
      setSesion(nuevaSesion);
      setCargando(false);
    });

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // En web, el cliente de Supabase ya procesa los tokens de la URL.
    if (!urlEntrante || Platform.OS === 'web') return;
    crearSesionDesdeUrl(urlEntrante).catch(() => {
      // Un link sin tokens (por ejemplo, abrir la app desde el ícono) no es un error.
    });
  }, [urlEntrante]);

  return (
    <AuthContext.Provider value={{ sesion, usuario: sesion?.user ?? null, cargando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): ValorAuth {
  const valor = useContext(AuthContext);
  if (!valor) {
    throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  }
  return valor;
}

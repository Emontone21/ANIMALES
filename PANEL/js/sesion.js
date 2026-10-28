/**
 * Ingreso y sesión con Supabase Auth (email y contraseña), con supabase-js
 * cargado desde el CDN con su hash (index.html). La sesión vive en
 * sessionStorage: se cierra al cerrar la pestaña. Nunca se abre una sesión con
 * tokens que lleguen en la URL (`detectSessionInUrl: false`).
 */

import { codigoDeErrorDeIngreso } from './datos.js';

export class ErrorDeIngreso extends Error {
  constructor(codigo) {
    super(codigo);
    this.codigo = codigo;
  }
}

/** sessionStorage si se puede usar; si no (modo privado estricto), en memoria. */
function almacenamiento() {
  try {
    const s = window.sessionStorage;
    s.setItem('panel-spot-prueba', '1');
    s.removeItem('panel-spot-prueba');
    return s;
  } catch {
    const memoria = new Map();
    return {
      getItem: (clave) => memoria.get(clave) ?? null,
      setItem: (clave, valor) => memoria.set(clave, valor),
      removeItem: (clave) => memoria.delete(clave),
    };
  }
}

/** null si supabase-js no cargó (por ejemplo, el CDN no respondió). */
export function crearSesion({ url, clavePublica }) {
  const biblioteca = globalThis.supabase;
  if (!biblioteca || typeof biblioteca.createClient !== 'function') return null;

  const cliente = biblioteca.createClient(url, clavePublica, {
    auth: {
      storage: almacenamiento(),
      storageKey: 'panel-spot-sesion',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return {
    /** El token vigente (supabase-js lo renueva si venció), o null. */
    async token() {
      try {
        const { data, error } = await cliente.auth.getSession();
        if (error) return null;
        return data.session?.access_token ?? null;
      } catch {
        return null;
      }
    },

    async ingresar(email, contrasena) {
      let resultado;
      try {
        resultado = await cliente.auth.signInWithPassword({ email, password: contrasena });
      } catch (error) {
        throw new ErrorDeIngreso(codigoDeErrorDeIngreso(error));
      }
      if (resultado.error) throw new ErrorDeIngreso(codigoDeErrorDeIngreso(resultado.error));
      const token = resultado.data.session?.access_token;
      if (!token) throw new ErrorDeIngreso('otro');
      return token;
    },

    /** Cierra solo esta sesión: la de la app en el celular sigue abierta. */
    async salir() {
      try {
        await cliente.auth.signOut({ scope: 'local' });
      } catch {
        // Si no hay red, igual se borra la sesión guardada.
      }
    },
  };
}

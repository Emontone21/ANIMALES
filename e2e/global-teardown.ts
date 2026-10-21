/**
 * Después de las pruebas: borra lo que haya quedado de las cuentas de prueba
 * (las que la última prueba no llegó a borrar, sus fotos y sus capturas), con
 * la API de Storage y la de Auth, nunca por SQL. Corre aunque las pruebas o el
 * setup fallen a mitad.
 */
import {
  borrarArchivoCuentas,
  type Cuenta,
  cuentasParaLimpiar,
  guardarCuentas,
  leerCuentas,
} from './cuentas';
import { leerEntorno } from './entorno';
import { limpiarCuenta } from './supabase';

export default async function globalTeardown(): Promise<void> {
  const archivo = leerCuentas();
  if (!archivo) return;

  const entorno = leerEntorno();
  if (archivo.supabaseUrl !== entorno.supabaseUrl) {
    console.warn(
      `[e2e] las cuentas de e2e/.auth/cuentas.json son de ${archivo.supabaseUrl} y el entorno apunta a ${entorno.supabaseUrl}: no se borra nada.`,
    );
    return;
  }

  const quedan: Cuenta[] = [];
  for (const cuenta of cuentasParaLimpiar(archivo)) {
    if (!(await limpiarCuenta(entorno, cuenta))) quedan.push(cuenta);
  }

  if (quedan.length === 0) {
    borrarArchivoCuentas();
    console.log('[e2e] cuentas de prueba borradas.');
    return;
  }
  // Las que no se pudieron borrar quedan anotadas: el próximo setup las vuelve a probar.
  guardarCuentas({ ...archivo, cuentas: [], pendientes: quedan });
  console.warn(
    `[e2e] no se pudieron borrar: ${quedan.map((c) => c.email).join(', ')}. Quedan en e2e/.auth/cuentas.json.`,
  );
}

/**
 * Las cuentas de prueba: dos por proyecto de Playwright ("telefono" y
 * "computadora"), familia (publica un perdido, y es moderadora) y vecina (lo ve,
 * lo resguarda, le escribe). Las crea global-setup.ts y las borra
 * global-teardown.ts. Viven en e2e/.auth/cuentas.json, que no se versiona.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { RUTAS } from './entorno';

export type Rol = 'familia' | 'vecina';

export type Cuenta = {
  id: string;
  email: string;
  contrasena: string;
  /** El nombre público. Lo cambia la prueba de Perfil: ahí se actualiza en memoria. */
  nombre: string;
  rol: Rol;
  proyecto: string;
  /** Letras al azar, iguales para las dos cuentas de un proyecto: hacen únicos los textos. */
  sufijo: string;
};

export type ArchivoCuentas = {
  /** El proyecto de Supabase donde se crearon: el teardown no borra en otro. */
  supabaseUrl: string;
  creadoEn: string;
  cuentas: Cuenta[];
  /** De una corrida anterior que no se pudieron limpiar: el teardown lo vuelve a probar. */
  pendientes?: Cuenta[];
};

/** Solo letras: un color con números no se comparte (colorParaCompartir, src/lib/compartir.ts). */
export function letrasAlAzar(cantidad: number): string {
  const letras = 'abcdefghijklmnopqrstuvwxyz';
  return [...randomBytes(cantidad)].map((byte) => letras[byte % letras.length]).join('');
}

/** Larga y con todos los tipos de carácter, por si el proyecto pide una política de contraseñas. */
export function contrasenaAlAzar(): string {
  return `${randomBytes(18).toString('base64url')}Aa1!`;
}

export function leerCuentas(): ArchivoCuentas | null {
  if (!existsSync(RUTAS.cuentas)) return null;
  return JSON.parse(readFileSync(RUTAS.cuentas, 'utf8')) as ArchivoCuentas;
}

/** Se guarda después de crear cada cuenta: si algo falla a mitad, el teardown sabe qué borrar. */
export function guardarCuentas(archivo: ArchivoCuentas): void {
  mkdirSync(path.dirname(RUTAS.cuentas), { recursive: true });
  writeFileSync(RUTAS.cuentas, `${JSON.stringify(archivo, null, 2)}\n`, { mode: 0o600 });
}

export function borrarArchivoCuentas(): void {
  rmSync(RUTAS.cuentas, { force: true });
}

/** Las dos cuentas de un proyecto, o un error claro si el setup no las creó. */
export function cuentasDelProyecto(proyecto: string): { familia: Cuenta; vecina: Cuenta } {
  const archivo = leerCuentas();
  const de = (rol: Rol) => archivo?.cuentas.find((c) => c.proyecto === proyecto && c.rol === rol);
  const familia = de('familia');
  const vecina = de('vecina');
  if (!familia || !vecina) {
    throw new Error(
      `No están las cuentas de prueba del proyecto "${proyecto}" en ${RUTAS.cuentas}: las crea e2e/global-setup.ts al correr la suite.`,
    );
  }
  // Copias: las pruebas cambian el nombre en memoria sin tocar el archivo.
  return { familia: { ...familia }, vecina: { ...vecina } };
}

/** Los ids de todas las cuentas de esta corrida (los dos proyectos). */
export function idsDeLasCuentas(): string[] {
  return leerCuentas()?.cuentas.map((c) => c.id) ?? [];
}

/** Todas las que hay que limpiar: las de esta corrida y las pendientes de otras. */
export function cuentasParaLimpiar(archivo: ArchivoCuentas): Cuenta[] {
  return [...archivo.cuentas, ...(archivo.pendientes ?? [])];
}

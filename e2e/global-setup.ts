/**
 * Antes de las pruebas: valida el entorno (nunca producción), arma el build web
 * apuntado al proyecto de pruebas y crea las cuentas de cada proyecto de
 * Playwright. No corre con `--list`.
 */
import type { FullConfig } from '@playwright/test';

import { prepararBuild } from './armar-web';
import {
  type ArchivoCuentas,
  borrarArchivoCuentas,
  type Cuenta,
  contrasenaAlAzar,
  cuentasParaLimpiar,
  guardarCuentas,
  leerCuentas,
  letrasAlAzar,
  type Rol,
} from './cuentas';
import { type Entorno, leerEntorno } from './entorno';
import {
  crearCuenta,
  ErrorSupabase,
  ingresarConContrasena,
  leerPerfil,
  leerVersionTerminos,
  limpiarCuenta,
  marcarModeradora,
} from './supabase';

const NOMBRES: Record<Rol, string> = { familia: 'Familia', vecina: 'Vecina' };

export default async function globalSetup(config: FullConfig): Promise<void> {
  const entorno = leerEntorno();
  const terminosVersion = leerVersionTerminos();

  // Lo que dejó una corrida que se cortó antes del teardown. Lo que no se
  // pueda limpiar queda anotado en `pendientes`, y el teardown lo vuelve a probar.
  const pendientes: Cuenta[] = [];
  const anteriores = leerCuentas();
  if (anteriores) {
    const viejas = cuentasParaLimpiar(anteriores);
    if (anteriores.supabaseUrl !== entorno.supabaseUrl) {
      console.warn(
        `[e2e] e2e/.auth/cuentas.json es de otro proyecto (${anteriores.supabaseUrl}): borrá a mano ${viejas.map((c) => c.email).join(', ')}.`,
      );
    } else {
      console.log(`[e2e] limpiando ${viejas.length} cuentas de una corrida anterior…`);
      for (const cuenta of viejas) {
        if (!(await limpiarCuenta(entorno, cuenta))) pendientes.push(cuenta);
      }
    }
    borrarArchivoCuentas();
  }

  await prepararBuild(entorno);

  const archivo: ArchivoCuentas = {
    supabaseUrl: entorno.supabaseUrl,
    creadoEn: new Date().toISOString(),
    cuentas: [],
    pendientes,
  };
  guardarCuentas(archivo);
  const proyectos = [...new Set(config.projects.map((p) => p.name).filter(Boolean))];
  // Un dominio reservado: las cuentas se crean ya confirmadas y no se manda ningún mail.
  const dominio = process.env.E2E_EMAIL_DOMINIO?.trim() || 'example.com';
  for (const proyecto of proyectos) {
    const sufijo = letrasAlAzar(5);
    for (const rol of ['familia', 'vecina'] as const) {
      const email = `e2e-${proyecto}-${rol}-${sufijo}@${dominio}`.toLowerCase();
      const contrasena = contrasenaAlAzar();
      const nombre = `${NOMBRES[rol]} ${sufijo}`;
      const id = await crearCuenta(entorno, { email, contrasena, nombre, terminosVersion }).catch(
        (error: unknown) => {
          if (error instanceof ErrorSupabase && error.codigo === 'email_address_invalid') {
            throw new Error(
              `Supabase no acepta emails @${dominio}: elegí otro dominio con E2E_EMAIL_DOMINIO (no se manda ningún mail).`,
            );
          }
          throw error;
        },
      );
      const cuenta: Cuenta = { id, email, contrasena, nombre, rol, proyecto, sufijo };
      archivo.cuentas.push(cuenta);
      guardarCuentas(archivo);

      if (rol === 'familia') await marcarModeradora(entorno, id);
      await revisarPerfil(entorno, cuenta, terminosVersion);
    }
  }

  // Una vez alcanza: el captcha es de todo el proyecto, y el build no lo trae.
  const primera = archivo.cuentas[0];
  if (primera) {
    try {
      await ingresarConContrasena(entorno, primera.email, primera.contrasena);
    } catch (error) {
      if (error instanceof ErrorSupabase && error.codigo === 'captcha_failed') {
        throw new Error(
          'El proyecto de pruebas pide captcha para ingresar: spot-pruebas no lo tiene que tener (README, "Proyecto de pruebas").',
        );
      }
      throw error;
    }
  }

  console.log(
    `[e2e] cuentas de prueba: ${archivo.cuentas.map((c) => `${c.proyecto}/${c.rol} ${c.email}`).join(', ')}`,
  );
}

/** La cuenta quedó como las pruebas la necesitan: con su nombre, los términos y, la familia, moderadora. */
async function revisarPerfil(
  entorno: Entorno,
  cuenta: Cuenta,
  terminosVersion: string,
): Promise<void> {
  const perfil = await leerPerfil(entorno, cuenta.id);
  if (!perfil) {
    throw new Error(
      `La cuenta ${cuenta.email} no tiene perfil: falta el trigger handle_new_user en el proyecto de pruebas.`,
    );
  }
  if (perfil.terminos_version !== terminosVersion) {
    throw new Error(
      `La cuenta ${cuenta.email} no quedó con los términos aceptados (perfiles.terminos_version = ${String(perfil.terminos_version)}; la app usa ${terminosVersion}). ¿Falta aplicar en el proyecto de pruebas la migración que sube config_app.terminos_version?`,
    );
  }
  if (perfil.nombre_publico !== cuenta.nombre) {
    throw new Error(`La cuenta ${cuenta.email} quedó con el nombre "${perfil.nombre_publico}".`);
  }
  if (perfil.es_moderador !== (cuenta.rol === 'familia')) {
    throw new Error(`La cuenta ${cuenta.email} quedó con es_moderador = ${perfil.es_moderador}.`);
  }
}

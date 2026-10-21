/**
 * Ayudas de los flujos: ingresar, elegir la foto, usar la ubicación, encontrar
 * hojas y botones. Los textos salen de src/i18n/es-UY.ts, como en la app; los
 * selectores son los roles y nombres accesibles que arma react-native-web
 * (accessibilityRole → role, accessibilityLabel → aria-label).
 */
import type { Locator, Page } from '@playwright/test';

import { t } from '../src/i18n/es-UY';
import type { Cuenta } from './cuentas';
import { RUTAS } from './entorno';
import { expect } from './fixtures';

/** Una persona de los flujos: su cuenta y su pestaña (cada una en su navegador). */
export type Persona = { cuenta: Cuenta; pagina: Page };

/** Una pantalla o una hoja: donde se busca. */
export type Alcance = Page | Locator;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Un texto que empieza así ("Perdido desde …", "Resuelto por Ana, …"). */
export function empiezaCon(texto: string): RegExp {
  return new RegExp(`^${escapar(texto)}`);
}

/** Boton y Pressable con accessibilityRole="button": el nombre es su título o su accessibilityLabel. */
export function boton(alcance: Alcance, nombre: string): Locator {
  return alcance.getByRole('button', { name: nombre, exact: true });
}

/** Una opción de Chips u OpcionesTarjeta (role="radio", aria-checked). */
export function opcion(alcance: Alcance, nombre: string | RegExp): Locator {
  return alcance.getByRole('radio', { name: nombre, exact: typeof nombre === 'string' });
}

/** El título de una pantalla o de un caso (accessibilityRole="header"). */
export function titulo(alcance: Alcance, texto: string): Locator {
  return alcance.getByRole('heading', { name: texto, exact: true });
}

/**
 * Un texto visible: entero, o que cumpla la expresión. getByText (a diferencia
 * de getByRole) también encuentra lo que está oculto, y en web las pantallas
 * de atrás en la pila siguen en el DOM con display: none (por ejemplo, la
 * lista de Actividad con el último mensaje, detrás de la conversación).
 */
export function texto(alcance: Alcance, contenido: string | RegExp): Locator {
  return alcance
    .getByText(contenido, { exact: typeof contenido === 'string' })
    .filter({ visible: true });
}

/** Un CampoTexto: el TextInput lleva su etiqueta como accessibilityLabel. Solo los visibles. */
export function campo(alcance: Alcance, etiqueta: string): Locator {
  return alcance.getByLabel(etiqueta, { exact: true }).filter({ visible: true });
}

/**
 * Una hoja (Hoja) o un menú (MenuOpciones): el Modal de react-native-web es
 * un role="dialog" sin nombre; se reconoce por su título.
 */
export function hoja(pagina: Page, tituloHoja: string): Locator {
  return pagina.getByRole('dialog').filter({ has: titulo(pagina, tituloHoja) });
}

/**
 * Una tarjeta de una lista (Moderación) que no tiene rol propio: el elemento
 * más adentro que contiene todo lo pedido. Los que lo contienen también
 * coinciden y van antes en el documento; por eso, el último.
 * Con un testID en las tarjetas sería directo (pendiente en
 * docs/reportes/2026-10-21-auditoria-2.md).
 */
export function tarjeta(pagina: Page, ...contenidos: (string | Locator)[]): Locator {
  let candidatos = pagina.locator('div').filter({ visible: true });
  for (const contenido of contenidos) {
    candidatos =
      typeof contenido === 'string'
        ? candidatos.filter({ hasText: contenido })
        : candidatos.filter({ has: contenido });
  }
  return candidatos.last();
}

/** Ingresar, el formulario de email y contraseña (/auth/ingresar), desde Perfil. */
export async function abrirIngresar(pagina: Page): Promise<void> {
  await pagina.goto('/perfil');
  await boton(pagina, t.auth.ingresar).click();
  await expect(pagina).toHaveURL(/\/auth\/ingresar$/);
}

export async function completarIngreso(pagina: Page, cuenta: Cuenta): Promise<void> {
  await campo(pagina, t.auth.email).fill(cuenta.email);
  await campo(pagina, t.auth.contrasena).fill(cuenta.contrasena);
  await boton(pagina, t.auth.ingresar).click();
}

/** Ingresa y abre Perfil, que saluda con el nombre público. */
export async function ingresar(pagina: Page, cuenta: Cuenta): Promise<void> {
  await abrirIngresar(pagina);
  await completarIngreso(pagina, cuenta);
  // Al abrir sesión, Stack.Protected cierra Ingresar solo y la app queda en el mapa.
  await expect(pagina).not.toHaveURL(/\/auth\/ingresar/);
  await pagina.goto('/perfil');
  await expect(texto(pagina, t.perfil.hola(cuenta.nombre))).toBeVisible();
}

/**
 * Elige e2e/datos/perro.jpg. En web, "Sacar foto" y "Elegir de la galería"
 * abren el selector de archivos del navegador (expo-image-picker crea un
 * <input type="file"> y lo toca: src/hooks/useElegirFoto.ts).
 */
export async function elegirFoto(pagina: Page, abrir: Locator): Promise<void> {
  const selector = pagina.waitForEvent('filechooser');
  await abrir.click();
  await (await selector).setFiles(RUTAS.foto);
}

/** "Usar mi ubicación": el navegador da la de Montevideo que fija la configuración. */
export async function usarMiUbicacion(alcance: Alcance): Promise<void> {
  await boton(alcance, t.publicar.usarGps).click();
  await expect(texto(alcance, empiezaCon(t.publicar.ubicacionMarcada))).toBeVisible();
}

/** Después de publicar, la app va al detalle (/animal/<id>): el id del caso nuevo. */
export async function idDelCasoNuevo(pagina: Page): Promise<string> {
  // Subir la foto con sus variantes y publicar puede tardar.
  await pagina.waitForURL(new RegExp(`/animal/${UUID}$`), { timeout: 45_000 });
  return new URL(pagina.url()).pathname.split('/').pop() as string;
}

export async function idDeLaConversacion(pagina: Page): Promise<string> {
  await pagina.waitForURL(new RegExp(`/conversacion/${UUID}$`));
  return new URL(pagina.url()).pathname.split('/').pop() as string;
}

/** Que una foto (expo-image la dibuja como <img>) haya cargado de verdad. */
export async function esperarFoto(imagen: Locator): Promise<void> {
  await expect(imagen).toBeVisible();
  await expect
    .poll(() => imagen.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
      message: 'la foto no cargó',
    })
    .toBeGreaterThan(0);
}

/** Escribe y manda un mensaje en la conversación abierta. */
export async function mandarMensaje(pagina: Page, texto: string): Promise<void> {
  const entrada = campo(pagina, t.mensajes.placeholder);
  await entrada.fill(texto);
  await boton(pagina, t.mensajes.enviar).click();
  await expect(entrada).toHaveValue('');
}

/**
 * El `test` de la suite: navegadores con las opciones de cada proyecto, las
 * cuentas de prueba y una vigilancia que hace fallar la prueba si el navegador
 * muestra un error en la consola (console.error) o una excepción sin atrapar.
 *
 * Excepciones permitidas (ninguna más):
 *  - Una foto ajena que no carga: una <img> que no es de la app ni de las
 *    carpetas de Storage de las cuentas de esta corrida. El mapa, "Cerca tuyo"
 *    y Moderación muestran todos los casos del proyecto de pruebas, también
 *    los datos de demo (supabase/seed.sql), que traen fotos de otros sitios
 *    (cataas.com, placedog.net) que a veces no responden. No es un error de
 *    la app ni de lo que prueba la suite. Las teselas, el estilo y las letras
 *    del mapa no entran acá: MapLibre los pide con fetch, no como imagen.
 *  - Lo que una prueba declara con `vigilancia.esperar(…)` justo antes de
 *    provocarlo, con su motivo (por ejemplo, ingresar con una cuenta borrada).
 *
 * Además, un pedido a la Supabase de producción también hace fallar la prueba.
 */
import { rmSync } from 'node:fs';

import {
  test as base,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { type Cuenta, cuentasDelProyecto, idsDeLasCuentas } from './cuentas';
import { leerEntorno, REF_PRODUCCION, SITIO } from './entorno';

export { expect };

/** Un error de consola que una prueba provoca a propósito. */
export type ErrorEsperado = {
  /** Contra el texto del mensaje (o de la excepción). */
  texto: RegExp;
  /** Contra la URL de donde viene, si la tiene. */
  url?: RegExp;
  motivo: string;
};

const RECURSO_QUE_FALLO = /^Failed to load resource/;

export class Vigilancia {
  private errores: string[] = [];
  /** Lo que se dejó pasar por una de las excepciones: queda anotado en la prueba. */
  private permitidos: string[] = [];
  private esperados: ErrorEsperado[] = [];
  /** Las <img> pedidas que no son de la app ni de las cuentas de prueba. */
  private readonly imagenesAjenas = new Set<string>();

  constructor(
    private readonly supabaseOrigen: string,
    /** Los ids de las cuentas de prueba: sus carpetas de Storage son las fotos propias. */
    private readonly idsPropios: string[],
  ) {}

  vigilar(pagina: Page, nombre: string): void {
    pagina.on('request', (pedido) => {
      const url = pedido.url();
      if (url.includes(REF_PRODUCCION)) this.anotar(`[${nombre}] pedido a producción: ${url}`);
      if (pedido.resourceType() === 'image' && !this.esImagenPropia(url)) {
        this.imagenesAjenas.add(url);
      }
    });
    pagina.on('console', (mensaje) => {
      if (mensaje.type() !== 'error') return;
      const texto = mensaje.text();
      const origen = mensaje.location().url;
      if (RECURSO_QUE_FALLO.test(texto) && this.imagenesAjenas.has(origen)) {
        this.permitidos.push(`foto ajena que no cargó: ${origen}`);
        return;
      }
      if (this.esEsperado(texto, origen)) return;
      this.anotar(
        `[${nombre}] console.error en ${pagina.url()}: ${texto}${origen ? ` (${origen})` : ''}`,
      );
    });
    pagina.on('pageerror', (error) => {
      if (this.esEsperado(error.message, '')) return;
      this.anotar(
        `[${nombre}] excepción sin atrapar en ${pagina.url()}: ${error.stack ?? error.message}`,
      );
    });
    pagina.on('crash', () => this.anotar(`[${nombre}] la pestaña se colgó en ${pagina.url()}`));
  }

  /** Permite un error hasta el final de la prueba que lo declara. */
  esperar(esperado: ErrorEsperado): void {
    this.esperados.push(esperado);
  }

  /**
   * Los errores desde la última vez y lo que se dejó pasar; olvida los
   * esperados de la prueba que terminó.
   */
  tomarErrores(): { errores: string[]; permitidos: string[] } {
    const resultado = { errores: this.errores, permitidos: this.permitidos };
    this.errores = [];
    this.permitidos = [];
    this.esperados = [];
    return resultado;
  }

  private anotar(error: string): void {
    this.errores.push(`${new Date().toISOString()} ${error}`);
  }

  private esEsperado(texto: string, url: string): boolean {
    const esperado = this.esperados.find((e) => e.texto.test(texto) && (!e.url || e.url.test(url)));
    if (esperado) this.permitidos.push(`esperado (${esperado.motivo}): ${texto}`);
    return esperado !== undefined;
  }

  /** De la app (íconos, logo) o de las carpetas de Storage de las cuentas de prueba. */
  private esImagenPropia(url: string): boolean {
    let direccion: URL;
    try {
      direccion = new URL(url);
    } catch {
      return true;
    }
    if (direccion.protocol === 'data:' || direccion.protocol === 'blob:') return true;
    if (direccion.origin === new URL(SITIO).origin) return true;
    if (direccion.origin !== this.supabaseOrigen) return false;
    // /storage/v1/object/public/fotos/<id>/… o, las capturas, /sign/capturas/<id>/…
    const carpeta = /^\/storage\/v1\/object\/(?:public|sign)\/(?:fotos|capturas)\/([^/]+)\//.exec(
      direccion.pathname,
    )?.[1];
    return carpeta !== undefined && this.idsPropios.includes(carpeta);
  }
}

/** Las opciones de contexto del proyecto (config `use`) que valen para browser.newContext. */
const OPCIONES_DE_CONTEXTO = [
  'baseURL',
  'viewport',
  'deviceScaleFactor',
  'isMobile',
  'hasTouch',
  'userAgent',
  'locale',
  'timezoneId',
  'geolocation',
  'permissions',
  'colorScheme',
  'serviceWorkers',
] as const satisfies readonly (keyof BrowserContextOptions)[];

type Registro = { nombre: string; grabando: boolean };

/**
 * Abre navegadores (contextos) con las opciones del proyecto: cada persona
 * tiene el suyo, con su sesión. Vigila todas sus pestañas y, si una prueba
 * falla, adjunta la traza y una captura de cada uno.
 */
export class Navegador {
  private readonly contextos = new Map<BrowserContext, Registro>();
  private readonly trazasDeCerrados: { nombre: string; ruta: string }[] = [];
  private readonly conTrazas = process.env.E2E_TRAZAS !== '0';
  private prueba: TestInfo | null = null;
  private cantidad = 0;

  constructor(
    private readonly browser: Browser,
    private readonly opciones: BrowserContextOptions,
    readonly vigilancia: Vigilancia,
  ) {}

  /** Una pestaña en un navegador nuevo, sin sesión. `nombre` aparece en los errores y adjuntos. */
  async nuevaPagina(nombre: string): Promise<Page> {
    this.cantidad += 1;
    const registro = { nombre: `${this.cantidad}-${nombre}`, grabando: false };
    const contexto = await this.browser.newContext(this.opciones);
    contexto.on('page', (pagina) => this.vigilancia.vigilar(pagina, nombre));
    if (this.conTrazas) {
      await contexto.tracing.start({ screenshots: true, snapshots: true, title: nombre });
      registro.grabando = true;
      // Fuera de una prueba (beforeAll) no se guarda: la traza empieza con la primera prueba.
      if (!this.prueba) {
        await contexto.tracing.stopChunk();
        registro.grabando = false;
      }
    }
    this.contextos.set(contexto, registro);
    return contexto.newPage();
  }

  /** Cierra el navegador de esa pestaña; su traza queda por si la prueba falla. */
  async cerrar(pagina: Page): Promise<void> {
    const contexto = pagina.context();
    const registro = this.contextos.get(contexto);
    if (registro?.grabando && this.prueba) {
      const ruta = this.prueba.outputPath(`traza-${registro.nombre}.zip`);
      await contexto.tracing.stopChunk({ path: ruta });
      this.trazasDeCerrados.push({ nombre: registro.nombre, ruta });
    }
    this.contextos.delete(contexto);
    await contexto.close();
  }

  async empezarPrueba(prueba: TestInfo): Promise<void> {
    this.prueba = prueba;
    if (!this.conTrazas) return;
    for (const [contexto, registro] of this.contextos) {
      if (registro.grabando) continue;
      await contexto.tracing.startChunk({ title: prueba.title });
      registro.grabando = true;
    }
  }

  /** `fallo`: si la prueba falló o si el navegador mostró errores. */
  async terminarPrueba(prueba: TestInfo, fallo: boolean): Promise<void> {
    for (const [contexto, registro] of this.contextos) {
      if (fallo) {
        for (const pagina of contexto.pages()) {
          const captura = await pagina.screenshot().catch(() => null);
          if (captura) {
            await prueba.attach(`captura-${registro.nombre}`, {
              body: captura,
              contentType: 'image/png',
            });
          }
        }
      }
      if (!registro.grabando) continue;
      const ruta = prueba.outputPath(`traza-${registro.nombre}.zip`);
      await contexto.tracing.stopChunk(fallo ? { path: ruta } : undefined);
      registro.grabando = false;
      if (fallo) await prueba.attach(`traza-${registro.nombre}`, { path: ruta });
    }
    for (const traza of this.trazasDeCerrados) {
      if (fallo) await prueba.attach(`traza-${traza.nombre}`, { path: traza.ruta });
      else rmSync(traza.ruta, { force: true });
    }
    this.trazasDeCerrados.length = 0;
    this.prueba = null;
  }

  async cerrarTodo(): Promise<void> {
    for (const contexto of this.contextos.keys()) await contexto.close();
    this.contextos.clear();
  }
}

type FixturesDePrueba = { vigilarConsola: void };

type FixturesDelWorker = {
  navegador: Navegador;
  /** Las dos cuentas de este proyecto (copias: la prueba de Perfil les cambia el nombre). */
  cuentas: { familia: Cuenta; vecina: Cuenta };
};

export const test = base.extend<FixturesDePrueba, FixturesDelWorker>({
  navegador: [
    async ({ browser }, usar, worker) => {
      const entorno = leerEntorno();
      // Las cuentas las creó global-setup.ts antes de que arranque el worker: no cambian.
      const ids = idsDeLasCuentas();
      const vigilancia = new Vigilancia(new URL(entorno.supabaseUrl).origin, ids);
      const use = worker.project.use as BrowserContextOptions;
      const opciones = Object.fromEntries(
        OPCIONES_DE_CONTEXTO.filter((clave) => use[clave] !== undefined).map((clave) => [
          clave,
          use[clave],
        ]),
      ) as BrowserContextOptions;
      const navegador = new Navegador(browser, opciones, vigilancia);
      await usar(navegador);
      await navegador.cerrarTodo();
    },
    { scope: 'worker' },
  ],

  cuentas: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, usar, worker) => {
      await usar(cuentasDelProyecto(worker.project.name));
    },
    { scope: 'worker' },
  ],

  // También la pestaña de siempre de Playwright, si alguna prueba la usa.
  page: async ({ page, navegador }, usar) => {
    navegador.vigilancia.vigilar(page, 'page');
    await usar(page);
  },

  vigilarConsola: [
    async ({ navegador }, usar, prueba) => {
      await navegador.empezarPrueba(prueba);
      await usar();
      const { errores, permitidos } = navegador.vigilancia.tomarErrores();
      for (const permitido of permitidos) {
        prueba.annotations.push({ type: 'consola (permitido)', description: permitido });
      }
      await navegador.terminarPrueba(
        prueba,
        prueba.status !== prueba.expectedStatus || errores.length > 0,
      );
      expect(
        errores,
        'El navegador mostró errores (ver las excepciones en e2e/fixtures.ts)',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

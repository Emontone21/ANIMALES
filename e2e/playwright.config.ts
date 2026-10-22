/**
 * Pruebas de punta a punta de la web de Spot con Playwright, contra el
 * proyecto de Supabase de pruebas (spot-pruebas), nunca contra producción.
 * Se corren con `npx playwright test --config e2e/playwright.config.ts`
 * (ver e2e/LEEME.md).
 *
 * Los mismos flujos en dos proyectos, "telefono" y "computadora", cada uno con
 * sus cuentas (familia y vecina, que crea global-setup.ts). De a una prueba por
 * vez: los flujos de cada proyecto comparten esas cuentas y van en orden.
 */
import path from 'node:path';

import { defineConfig } from '@playwright/test';

import { PUERTO, SITIO } from './entorno';

/** Proxy opcional para el navegador (por ejemplo, en un contenedor sin salida directa). */
const proxy = process.env.E2E_PROXY?.trim();

export default defineConfig({
  testDir: '.',
  testIgnore: ['**/.dist/**', '**/.auth/**'],
  outputDir: path.join(__dirname, '..', 'test-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Subir fotos y esperar a Supabase lleva su tiempo; cada prueba es un flujo entero.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, '..', 'playwright-report'), open: 'never' }],
  ],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  webServer: {
    command: `node servidor.mjs ${PUERTO}`,
    cwd: __dirname,
    // Responde aunque el build todavía no exista: Playwright levanta el servidor
    // antes del global-setup, que es el que arma e2e/.dist.
    url: `http://127.0.0.1:${PUERTO}/__salud`,
    reuseExistingServer: false,
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  use: {
    baseURL: SITIO,
    locale: 'es-UY',
    timezoneId: 'America/Montevideo',
    // Una ubicación fija en Montevideo, para "Usar mi ubicación".
    geolocation: { latitude: -34.9055, longitude: -56.1913 },
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    colorScheme: 'light',
    // El service worker solo sirve para instalar la app, que acá no se prueba.
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Las trazas y capturas de cada prueba que falla las adjunta e2e/fixtures.ts.
    trace: 'off',
    screenshot: 'off',
    launchOptions: proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {},
  },
  projects: [
    {
      name: 'telefono',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'computadora',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});

# Pruebas de punta a punta (Playwright)

Recorren la web de Spot como la usa la gente, contra el proyecto de Supabase de pruebas (**spot-pruebas**, `soafsmktmfmryeiixmpo`), **nunca contra producción**. Son los flujos de `docs/PRUEBAS-MANUALES.md` que no necesitan cámara, mail real, Google ni un teléfono de verdad.

**Estado:** escritas y ensayadas contra el build real con un Supabase falso en memoria, sin red. Todavía no se corrieron contra spot-pruebas: la primera corrida ahí es la que cuenta (ver `docs/reportes/2026-10-21-auditoria-2.md`).

## Qué hace

1. **Antes** (`global-setup.ts`): valida las variables, arma el build web con `npx expo export -p web --output-dir e2e/.dist --clear` apuntado al proyecto de pruebas (sin captcha y sin leer el `.env`) y crea dos cuentas por proyecto de Playwright: **familia** (moderadora) y **vecina**, ya confirmadas y con los términos vigentes aceptados. Las anota en `e2e/.auth/cuentas.json`.
2. **Las pruebas** (`flujos.spec.ts`), en orden, en dos proyectos: **telefono** (390 × 844, Android con Chrome) y **computadora** (1280 × 800). Cada persona en su navegador; la ubicación es fija en Montevideo y la foto es `e2e/datos/perro.jpg`:
   ingresar · publicar un perdido y un encontrado · después de publicar, activar las notificaciones del celular y apagarlas en Perfil (el push del navegador simulado: Chromium sin servicio de push no puede suscribirse; la suscripción se guarda de verdad en la base) · compartir (hoja del sistema, copiar el link, WhatsApp) · compartir en historias (el JPEG de 1080 × 1920, el contraste medido en la imagen, el link copiado y la descarga) · "Lo vi" · escribirle desde el historial y contestar · bloquear y desbloquear · resguardar (la familia ve el contacto; sin cuenta, no) · reunido · denunciar y moderar (ocultar, volver a mostrar, marcar revisada) · cambiar el nombre · reportar un error con captura y resolverlo · editar y borrar un reporte · borrar las dos cuentas.
   Aparte, `notificaciones.spec.ts`: el service worker de verdad recibe un push (entregado con el protocolo de depuración de Chromium) y muestra la notificación, agrupada por caso. No usa cuentas ni Supabase, y lanza el Chromium completo (`channel: 'chromium'`): el "headless shell" de las otras pruebas no da permiso de notificaciones.
3. **Después** (`global-teardown.ts`): borra lo que haya quedado de esas cuentas, aunque algo haya fallado: su contenido (con `borrar_mi_cuenta`, como la app), sus fotos y capturas (API de Storage, nunca SQL) y la cuenta. Si no puede, la deja anotada y el próximo setup lo vuelve a intentar.

Cada prueba **falla si el navegador muestra un `console.error` o una excepción**. Las únicas excepciones están explicadas al principio de `fixtures.ts`. Si una prueba falla, el reporte trae la traza y una captura de cada navegador.

## Variables

| Variable                       |                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `E2E_SUPABASE_URL`             | `https://soafsmktmfmryeiixmpo.supabase.co`                                                                    |
| `E2E_SUPABASE_PUBLISHABLE_KEY` | La publishable de spot-pruebas (o, si no hay, `E2E_SUPABASE_ANON_KEY`). Va dentro del build.                  |
| `E2E_SUPABASE_SECRET_KEY`      | La secreta de spot-pruebas. Solo para crear y borrar las cuentas y vaciar sus carpetas; nunca entra al build. |
| `E2E_SIN_BUILD=1`              | Opcional: reusa `e2e/.dist` si se armó para el mismo proyecto.                                                |
| `E2E_PROXY`                    | Opcional: proxy del navegador (por ejemplo `http://127.0.0.1:3128`).                                          |
| `E2E_TRAZAS=0`                 | Opcional: sin trazas (más rápido).                                                                            |
| `E2E_EMAIL_DOMINIO`            | Opcional: el dominio de los emails de prueba (por defecto `example.com`; no se manda ningún mail).            |

Las claves no van en ningún archivo del repo. Si `E2E_SUPABASE_URL` apunta a producción (o una clave legacy es de producción), todo se corta antes de empezar; el build tampoco puede nombrar a producción ni tener la clave secreta, y un pedido del navegador a producción hace fallar la prueba.

Si Node necesita un proxy para llegar a Supabase, sumá `NODE_USE_ENV_PROXY=1` (con `HTTPS_PROXY`). El navegador necesita salir a `tiles.openfreemap.org`: el mapa se carga de verdad.

El proyecto de pruebas tiene que tener todas las migraciones aplicadas (si `config_app.terminos_version` no es `VERSION_TERMINOS`, el setup lo avisa) y el captcha apagado.

## Cómo se corre

```bash
npm run e2e                          # playwright test --config e2e/playwright.config.ts
npm run e2e -- --project telefono    # uno solo de los dos
npm run e2e -- --headed              # mirando el navegador
npx playwright show-report playwright-report
```

`npx playwright test --config e2e/playwright.config.ts --list --reporter=list` lista las pruebas sin armar el build, sin crear cuentas y sin conectarse a nada.

## Qué queda en el proyecto de pruebas

Las cuentas, los casos, las conversaciones, las fotos y las capturas se borran. Los reportes de errores quedan, sin autor y sin captura, como al borrar cualquier cuenta: la API no deja borrarlos.

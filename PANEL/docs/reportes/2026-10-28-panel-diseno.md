# Panel de SPOT: diseño y esqueleto inicial · 2026-10-28

## 1. Resumen

**Qué se pidió:** el diseño completo y un esqueleto desplegable del "Panel de SPOT", un panel de administración aparte para el dueño del proyecto. Vive en `PANEL/` y se despliega como otro proyecto de Vercel (Root Directory `PANEL`). Sin integraciones ni datos reales, y sin tocar nada fuera de `PANEL/`.

**Qué se hizo**, todo dentro de `PANEL/`:
- **El esqueleto:**
  - una página sin framework ni build: ingreso, acceso denegado, cierre de sesión y el Inicio con todas sus secciones, en computadora y celular, claro y oscuro;
  - el login con Supabase Auth (supabase-js 2.117.3 desde jsDelivr, con SRI);
  - las funciones `api/config` y `api/estado`, que validan la sesión con `/auth/v1/user` y `ADMIN_USER_IDS`.
- **Las tarjetas:** cada una muestra Sin configurar (y la variable que falta), Pendiente (y el prompt que la resuelve) o Falla (si una variable tiene un valor que no sirve). Ninguna muestra datos.
- **Los links "Abrir en…"** ya funcionan con las variables no secretas.
- **`DISEÑO.md`:** objetivo, arquitectura (Mermaid), cada tarjeta con su fuente, umbrales y link, el diseño visual completo, seguridad, APIs externas, despliegue, alertas, plan de prompts y decisiones abiertas.
- **`propuestas/migracion-admin.sql`:** tabla `administradores`, `es_admin()` y `admin_resumen()`. No se aplicó.
- **`CLAUDE.md` del panel**, con las reglas de las próximas tareas.
- **Pruebas:**
  - 22 con `node --test`;
  - un verificador con 657 comprobaciones;
  - 76 comprobaciones en Chromium con un Supabase Auth falso.

**Cómo interpreté algunos puntos:**
- **"Funciona sin ninguna variable":** sin `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `ADMIN_USER_IDS` no hay con qué entrar, y mostrar el Inicio sin sesión iría contra la sección Seguridad. Por eso en ese caso la pantalla de ingreso dice cuáles faltan, deshabilita el formulario y la consola queda sin errores (comprobado). Con solo esas tres cargadas, todas las tarjetas quedan en Sin configurar o Pendiente.
- **"Cada función valida la sesión" y `api/config`:** la página necesita la URL y la clave pública de Supabase *antes* de poder ingresar. Por eso `api/config` sin sesión da solo eso (lo mismo que la app ya publica) y los nombres de las variables que faltan para entrar. Con una sesión de administración, valida igual que `api/estado` (401 o 403) y suma los datos de los links.
- **El servicio de visión:** el pedido habla de un Space de Hugging Face, pero `AGENTS.md` dice que el reconocimiento ya lo hace la Edge Function `reconocer` con la API de Claude. El esqueleto sigue el pedido (`LINK_VISION_URL`, link al Space), y `DISEÑO.md` (sección 10, decisión 1) propone mirar `reconocer` en su lugar.
- **Las fases:** el pedido pide la primera línea de la propuesta con "después de la Fase 5" y el comentario final sobre las Fases 5 a 7. Van tal cual, pero `AGENTS.md` ya marca hechas las fases 1 a 9 (migraciones hasta la 0027). La propuesta lo aclara en su encabezado y usa solo tablas y columnas de esas 27 migraciones.
- **Las fuentes:** van los subconjuntos Latin1 oficiales de IBM Plex, unos 120 KB en total contra 360 KB completos. Cubren el español y la puntuación; no las flechas, que el panel dibuja con íconos.

## 2. Cambios por archivo

Todo es nuevo y todo está en `PANEL/`.

**Página**
- `index.html`:
  - las metas `noindex`, `no-referrer` y `color-scheme`;
  - el sprite de íconos SVG de trazo y la huella de la marca;
  - supabase-js con versión fija, `integrity` y `crossorigin`;
  - `js/app.js` como módulo, sin scripts en línea.
- `estilos.css`:
  - las seis `@font-face`;
  - todos los colores como variables de `:root`, con su versión oscura (`prefers-color-scheme`);
  - el diseño de computadora y de celular (hasta 760 px);
  - pastillas, botones, tarjetas, listas y filas tocables;
  - los componentes para datos (`.numero`, `.barras`, `.uso`), todavía sin usar.
- `favicon.svg`: la huella sobre el acento. Es la única excepción de color, comprobada contra `estilos.css`.
- `robots.txt`: bloquea todo.
- `i18n/es-UY.js`: todos los textos, con voseo.
- `js/app.js`: el arranque (config, sesión, estado, Inicio), 401 → ingreso, 403 → cerrar sesión y "Acceso denegado", y actualizar y salir.
- `js/sesion.js`: supabase-js con `sessionStorage`, `detectSessionInUrl: false` y `signOut({ scope: 'local' })`, y los errores del ingreso como códigos propios.
- `js/api.js`: los pedidos a `/api/config` y `/api/estado`.
- `js/pantallas.js`: cargando, ingreso (con el aviso de configuración pendiente), acceso denegado y error.
- `js/inicio.js`:
  - cabecera, menú lateral o pestañas y vistas por hash;
  - "Necesita atención", "Configuración del panel" y las secciones de tarjetas;
  - las filas tocables en el celular y la lista de tokens;
  - el reloj "Actualizado hace X min".
- `js/componentes.js`: `el()` (solo `textContent`), íconos con `<use>`, marca, pastilla, botones, link "Abrir en…" y las líneas de "qué falta".
- `js/catalogo.js`: secciones, tarjetas, partes, links y la variable de cada token.
- `js/datos.js`: revisa lo que llega del servidor, arma los avisos y el resumen y traduce los errores de Supabase Auth.
- `js/enlaces.js`: arma y valida las URLs del dashboard de Supabase, Vercel, la app, las redes y el Space.
- `js/tiempo.js`: "recién", "hace X min" y "hace X h".

**Funciones**
- `api/_comun.js`:
  - lee y valida cada variable por su nombre;
  - `esClavePublica` rechaza la secret y la service_role;
  - `validarSesion` (`/auth/v1/user`, 5 s, sin redirecciones, `ADMIN_USER_IDS`) y respuestas `no-store`.
- `api/_catalogo.js`: qué necesita cada parte y cada tarjeta y el cálculo de su estado.
- `api/config.js`: configuración pública y, con sesión de administración, los datos de los links.
- `api/estado.js`: sesión, permiso y el estado de cada parte y tarjeta.

**Configuración**
- `vercel.json`:
  - CSP (scripts propios más el archivo exacto de jsDelivr; conexiones al propio dominio y a `*.supabase.co`);
  - `X-Robots-Tag`, `Referrer-Policy`, `X-Frame-Options`, `nosniff`, COOP y `Permissions-Policy`;
  - `no-store` en `api/`.
- `package.json`: `"type": "module"` y los scripts `verificar` y `probar`, sin dependencias.
- `.vercelignore`: no publica `*.md` de la raíz del panel, `docs/`, `propuestas/`, `pruebas/`, `herramientas/`, `.env.example` ni `.gitignore`.
- `.gitignore`: `.vercel`, `.env`, `.env.*` (salvo `.env.example`) y `node_modules/`.
- `.env.example`: cada variable, para qué sirve y si es pública, privada o secreta, sin valores.

**Fuentes**
- `fuentes/`: los seis woff2 de IBM Plex, `LICENSE.txt` (OFL 1.1) y `ORIGEN.md` (de dónde salió cada archivo y su SHA-256).

**Documentación y propuestas**
- `DISEÑO.md`: el diseño completo (ver el Resumen).
- `CLAUDE.md`: las reglas del panel.
- `propuestas/migracion-admin.sql`: la migración propuesta, con las pruebas que tendría que tener.

**Pruebas y herramientas**
- `pruebas/api.test.mjs`: config y estado con un Supabase Auth falso. Cubre las respuestas 401, 403, 502 y 503, la clave no pública, que ningún secreto aparezca en la respuesta, las variables inválidas y la validación de URLs.
- `pruebas/catalogo.test.mjs`: que el catálogo del servidor y el de la página coincidan, que cada variable tenga validación y esté en `.env.example`, y que haya textos para todo.
- `pruebas/datos.test.mjs`: config y estado normalizados, avisos, plurales, links, errores del ingreso, "hace X min" y vistas.
- `herramientas/verificar.mjs`:
  - `node --check`;
  - colores contra `DISEÑO.md`;
  - secretos y valores reales;
  - textos de `index.html`;
  - hashes de las fuentes;
  - sin `innerHTML` ni importaciones de fuera;
  - la CSP coherente con la página.

**Reporte**
- `docs/reportes/2026-10-28-panel-diseno.md`: este reporte.
- `docs/reportes/2026-10-28-panel-diseno/`: 8 capturas (con el Supabase falso de las pruebas, sin datos reales).

## 3. Verificaciones

### 3.1 Raíz, antes de empezar (rama recreada desde `main`, `60c6d47`)

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores (39 s). |
| `npm run lint` | Sin errores (10 s). |
| `npx expo export -p web` | Termina bien (11 s). Bloque `entry-d31c0e98….js` (1,1 MB). |
| `npm run test` (además de las tres pedidas) | 33 suites y 362 pruebas, todas pasan. |

No hizo falta `npm ci`: las dependencias ya estaban.

### 3.2 Panel

| Verificación | Resultado |
| --- | --- |
| `node --check` en los 19 archivos `.js` y `.mjs` | Sin errores. |
| `node herramientas/verificar.mjs` | 657 comprobaciones, 0 problemas. Para probar el verificador, en una copia se metieron 7 errores: un color cambiado, un `innerHTML`, un JWT, un valor en `.env.example`, otro `<title>`, una importación de `../../src` y una fuente alterada. Los detectó los 7. |
| `node --test pruebas/*.test.mjs` | 22 pruebas, todas pasan. |
| Secretos y valores reales | Ninguno. Revisa JWT, claves `sb_`, URLs de Supabase (salvo el ref de prueba `abcdefghijklmnopqrst`), ids de Vercel, dominios `.vercel.app`, tokens de Meta, LinkedIn, Hugging Face, GitHub y Anthropic, client ids de Google, claves privadas, uuids (salvo los de prueba `00000000-0000-4000-8000-…`) y emails (salvo `example.org`). |
| Colores | Las 24 variables de `estilos.css`, en claro y en oscuro, coinciden con las tablas de `DISEÑO.md` (4.1). No hay colores fuera de `:root`, salvo `favicon.svg`, que coincide. |
| ESLint y Prettier de la raíz sobre `PANEL/` (`npx eslint PANEL`) | Sin errores. `npm run lint` no revisa `PANEL/`. Al pasarle la carpeta a mano marcaba formato de Prettier y dos `Buffer` sin declarar: se formatearon los archivos del panel con el Prettier de la raíz y se usa `globalThis.Buffer`. |

**En el navegador:** Chromium con Playwright, con `PANEL/` servido como lo haría Vercel. Las funciones corren con sus encabezados de `vercel.json` y lo de `.vercelignore` da 404. Supabase Auth es falso (nunca se salió a la red), y supabase-js es el archivo del paquete de npm, para que el navegador compruebe el hash SRI de verdad. **76 de 76 bien:**
- **Sin variables:**
  - el ingreso dice las tres que faltan;
  - "Entrar" queda deshabilitado;
  - sin errores en la consola, sin violaciones de CSP y sin pedidos a otros sitios.
- **Encabezados:** CSP, `noindex`, `X-Frame-Options` y `Referrer-Policy`. Además, `robots.txt` bloquea todo, `/DISEÑO.md` da 404 y `/api/_comun` no es una función.
- **Ingreso:**
  - campos vacíos, contraseña equivocada, muchos intentos y captcha, cada uno con su texto;
  - con la cuenta habilitada entra al Inicio.
- **Inicio:**
  - las secciones en el orden pedido y "Nada necesita atención";
  - 12 tarjetas, todas punteadas y ninguna con números ni gráficas;
  - solo pastillas Pendiente o Sin configurar (y Funciona en Ingreso);
  - link a Supabase con el ref y, sin variables de Vercel, sin link;
  - `rel="noopener noreferrer"`, IBM Plex Sans y Mono cargadas y sin scroll horizontal.
- **Menú:**
  - "Redes" muestra solo Redes, con `aria-current` y el título de la pestaña;
  - el foco va al título;
  - Atrás vuelve al Inicio.
- **Actualizar, recargar y salir:**
  - Actualizar marca "Actualizado recién";
  - al recargar sigue la sesión;
  - Salir vuelve al ingreso, borra la sesión y cierra solo la del panel (`logout?scope=local`).
- **Celular:**
  - sin scroll horizontal;
  - Actualizar y Salir como íconos con nombre accesible;
  - pestañas, filas tocables que se abren (`aria-expanded`) y números en dos columnas;
  - todo lo tocable mide 44 px o más.
- **Claro y oscuro, computadora y celular:** entra y sin errores ni violaciones de CSP.
- **Otra cuenta:** "Acceso denegado", la sesión se borra y al recargar no entra.
- **Una sesión guardada que ya no sirve:** vuelve al ingreso con "Tu sesión venció".
- **Con los links y una variable inválida:**
  - "1 falla · 1 aviso";
  - los links armados con las variables y ninguno `javascript:`;
  - Vercel con token queda en Pendiente;
  - "Ver la configuración" lleva al bloque;
  - el token de Vercel no aparece en el HTML.
- **Si el CDN no responde o sirve un archivo distinto:** el ingreso se deshabilita con un aviso, y el navegador rechaza el archivo alterado por SRI.
- **Si `api/` no responde:** "No se pudo cargar el panel" con "Reintentar".

**Las capturas** están en `docs/reportes/2026-10-28-panel-diseno/`:
- Inicio en computadora, claro y oscuro;
- el Inicio con una falla;
- el comienzo del Inicio en el celular, claro y oscuro;
- el ingreso sin variables y el ingreso en el celular, oscuro;
- acceso denegado.

### 3.3 Raíz, después (con `PANEL/` completo)

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores. |
| `npx expo export -p web` | Termina bien. El bloque `entry-d31c0e98….js` es el mismo de antes: el panel no cambia el build de la app. |
| `npm run test` | 33 suites y 362 pruebas, todas pasan. |

`git status`: solo archivos dentro de `PANEL/`. `dist/` (de `expo export`) lo ignora el `.gitignore` de la raíz.

## 4. Pasos manuales

Detalle en `DISEÑO.md`, sección 7.

**1. Antes de nada, el captcha.** En Supabase → **Authentication → Attack Protection** (o "Bot and Abuse Protection"), fijate si **Enable Captcha protection** está prendido.
- **Si está prendido,** el ingreso del panel va a fallar con "pide un captcha" (`DISEÑO.md`, sección 10, decisión 2). Decidí antes de seguir.

**2. Tu cuenta y su id.**
1. La cuenta con la que vas a entrar tiene que tener contraseña. Si la creaste con Google, en la app usá "¿Olvidaste tu contraseña?" y poné una.
2. Copiá su id, de una de dos formas:
   - en Supabase → **Authentication → Users**, abrí tu cuenta y copiá **User UID**;
   - en el **SQL Editor**:
     ```sql
     select id from auth.users where email = '<tu email>';
     ```

**3. Crear el proyecto en Vercel.**
1. **Add New → Project** → importá el repositorio `Emontone21/ANIMALES`.
2. **Project Name:** el que elijas (por ejemplo `spot-panel`).
3. **Framework Preset:** Other.
4. **Root Directory:** `PANEL`, con "Include files outside the root directory in the Build Step" apagado.
5. **Build Command:** activá Override y dejalo vacío. Output Directory e Install Command, como vienen.
6. **Environment Variables:** solo **Production**, las de la tabla de abajo.
7. **Deploy.**

| Variable | Valor | Marcala Sensitive |
| --- | --- | --- |
| `SUPABASE_URL` | La URL del proyecto de la app (la misma de `EXPO_PUBLIC_SUPABASE_URL`) | No |
| `SUPABASE_PUBLISHABLE_KEY` | La publishable de la app (la misma de `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Nunca la secret ni la service_role. | No |
| `ADMIN_USER_IDS` | Tu id del paso 2 (si son varias, separadas por comas) | Sí |
| `LINK_APP_URL` | La dirección de la app en producción | No |
| `LINK_VERCEL_TEAM` | El slug del equipo, como aparece en `vercel.com/<equipo>/…` | No |
| `LINK_VERCEL_PROJECT` | El nombre del proyecto de la app en Vercel, como aparece en `vercel.com/<equipo>/<proyecto>` | No |
| `LINK_FACEBOOK_URL`, `LINK_INSTAGRAM_URL`, `LINK_LINKEDIN_URL` | La página de cada red (https) | No |
| `LINK_VISION_URL` | El Space (`https://huggingface.co/spaces/<dueño>/<nombre>`), si sigue existiendo | No |

Las de integraciones (`VERCEL_API_TOKEN`, `META_*` y `LINKEDIN_*`) se cargan en su prompt. Todas están en `.env.example`.

**4. Después del deploy, comprobá:**
- `https://<panel>/` muestra el ingreso y, al entrar, el Inicio;
- `https://<panel>/DISEÑO.md` da **404** (si no, `.vercelignore` no se aplicó: avisame);
- `https://<panel>/api/config` responde un JSON;
- en la consola del navegador no hay errores (sobre todo, ninguno de "integrity");
- con otra cuenta, "Acceso denegado".

Si cambiás una variable, hacé **Redeploy**.

**5. Ignored Build Step** (Settings → Git → Ignored Build Step → "Run my custom command"):
- **Proyecto del panel:**
  ```sh
  [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && [ "$VERCEL_GIT_PREVIOUS_SHA" != "$VERCEL_GIT_COMMIT_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- .
  ```
- **Proyecto `animales` (la app):**
  ```sh
  [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && [ "$VERCEL_GIT_PREVIOUS_SHA" != "$VERCEL_GIT_COMMIT_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':(exclude)PANEL'
  ```

Salida 0 cancela el build; ante cualquier duda (sin commit anterior, clone corto), construye.

**6. Supabase:** nada en esta tarea. La migración se aplica en el prompt "Datos internos".

## 5. Cambios necesarios fuera de `PANEL/`

**Ninguno obligatorio:** las cuatro verificaciones de la raíz pasan igual que antes. Dos recomendados, para un pedido aparte:

1. **`AGENTS.md`, sección "Estructura":** que quien trabaje en la app sepa que el panel existe y está aparte. Agregar al final de la lista:
   ```markdown
   - `PANEL/`: panel de administración, proyecto de Vercel aparte (Root Directory `PANEL`), sin build ni dependencias. Tiene sus propias reglas en `PANEL/CLAUDE.md`; nada de la app lo importa ni él importa nada de la app.
   ```
2. **`.vercelignore` de la raíz** (opcional, solo achica lo que sube el deploy de la app): agregar al final la línea
   ```
   PANEL/
   ```
   - Según la documentación de Vercel, el `.vercelignore` del Root Directory tiene prioridad sobre el de la raíz, así que no afectaría al proyecto del panel (que tiene el suyo).
   - Igual conviene comprobarlo con un deploy del panel después del cambio.
   - Sin este cambio no pasa nada: la app publica solo `dist/`.

## 6. Librerías del CDN y fuentes

| Qué | Versión | Origen | Hash | Licencia |
| --- | --- | --- | --- | --- |
| `@supabase/supabase-js` (`dist/umd/supabase.js`, 217 907 bytes) | 2.117.3, publicada el 7 de octubre de 2026. La 2.118.0 tenía 13 días: menos de las dos semanas de antigüedad. | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js` | SRI `sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R`. Paquete: `sha512-K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==` (el `integrity` del registro de npm). | MIT |
| IBM Plex Sans, Latin1, woff2 (400, 500, 600, 700) | `@ibm/plex-sans` 1.1.0 (fuente versión 3.005) | `github.com/IBM/plex`, etiqueta `@ibm/plex-sans@1.1.0`, `packages/plex-sans/fonts/split/woff2/` | SHA-256 de cada archivo en `fuentes/ORIGEN.md` | SIL OFL 1.1 (`fuentes/LICENSE.txt`) |
| IBM Plex Mono, Latin1, woff2 (400, 500) | `@ibm/plex-mono` 2.5.0 | `github.com/IBM/plex`, etiqueta `@ibm/plex-mono@2.5.0`, `packages/plex-mono/fonts/split/woff2/` | Ídem | SIL OFL 1.1 |

**Sobre el hash de supabase-js:**
- Desde esta sesión no se llega a jsDelivr, así que se calculó sobre el archivo del paquete del registro de npm, que es el que sirve jsDelivr sin cambios.
- En la prueba del navegador ese archivo cargó con el hash y uno alterado se rechazó.
- Falta verlo contra jsDelivr en el primer deploy (paso 4: sin errores de "integrity").

**Sobre las fuentes:** coinciden con las de la rama `master` del mismo día.

## 7. Pendientes y riesgos

- **No se desplegó.** La documentación de Vercel confirma:
  - las funciones con `export function GET(request)`;
  - que los archivos `api/_*.js` no son funciones;
  - el Output Directory por defecto.

  Que `.vercelignore` se aplique a los deploys desde Git está **a confirmar**: la documentación no lo dice explícito. Si no se aplica, se publicarían `DISEÑO.md`, `CLAUDE.md` y las propuestas. No tienen secretos, pero describen el sistema. El paso 4 lo comprueba.
- **Captcha:** si está activado en Supabase Auth, el panel no puede entrar hasta decidir (sección 10, decisión 2).
- **El servicio de visión** apunta a un Space que, según `AGENTS.md`, ya no es lo que reconoce las fotos (decisión 1).
- **La propuesta SQL no se probó en una base,** porque la tarea prohíbe correr SQL. Se escribió contra las 27 migraciones y va a tener sus pruebas en `supabase/tests/` cuando se aplique.
- **Lo que depende de la documentación de otros servicios:** varias rutas del dashboard de Supabase y algunos detalles de las APIs de Vercel, Meta y LinkedIn están marcados "a confirmar" en `DISEÑO.md`.
- **El token de Vercel no puede ser de solo lectura** (la documentación no ofrece permisos granulares). Es el secreto más delicado del panel: alcance mínimo y vencimiento corto.
- **LinkedIn:** si no aprueban la Community Management API, la tarjeta queda solo con el link (plan B).
- **Abuso de las funciones:** cada pedido llama a `/auth/v1/user`. Si alguien las llamara mucho, conviene una regla de Vercel Firewall.
- **Las dos listas de administradores** (`ADMIN_USER_IDS` y la tabla `administradores`) se mantienen a mano y tienen que coincidir.
- **La rama:** se recreó `claude/animales-repo-mxm2ja` desde `main` (el PR #22 ya estaba mergeado). El commit queda solo en esta sesión, **sin push**, como se pidió. El contenedor es temporal: si la sesión se cierra sin push, el commit se pierde.

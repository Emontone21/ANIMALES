# Ingresar con Google con el botón de Google · 2026-10-25

## 1. Resumen

**Qué se pidió:** que ingresar con Google no muestre la dirección de Supabase. Hoy la app usa `signInWithOAuth`, que pasa por `<proyecto>.supabase.co/auth/v1/callback`, y la pantalla de Google muestra esa dirección. El pedido: cambiarlo por el botón oficial de Google Identity Services con `signInWithIdToken` ("Google pre-built" de la documentación de Supabase), sin agregar nada más y sin aplicar nada en producción. En detalle:
- el botón en Ingresar y Registrarse, en español, solo en esas pantallas, con nonce y `use_fedcm_for_prompt`;
- el ID de cliente en `EXPO_PUBLIC_GOOGLE_CLIENT_ID`;
- el botón de siempre como respaldo;
- un aviso en los navegadores internos;
- la CSP;
- todo igual después de entrar;
- las pruebas.

**Qué se hizo:**
- **El botón oficial de Google** en Ingresar y Registrarse (web), debajo de una línea con "o":
  - Lo dibuja Google: "Continuar con Google" en español (`locale` `es-419`), en forma de píldora y del ancho de la columna.
  - El tema va con el esquema: `outline` en claro y `filled_black` en oscuro.
  - Al elegir la cuenta, Google le da a la página un token de identidad y la app abre la sesión con `signInWithIdToken`. No hay redirección: la ventana de Google muestra el sitio, no `…supabase.co`.
  - Registrarse no tenía Google: ahora lo tiene, con el mismo bloque.
- **Nonce:** cada pantalla arma 32 bytes al azar (`crypto.getRandomValues`).
  - Google recibe su hash SHA-256 en hexadecimal (`initialize({ nonce })`) y lo pone en el token.
  - Supabase recibe el original (`signInWithIdToken({ nonce })`), lo hashea y lo compara.
  - En producción, "Skip nonce checks" está apagado (comprobado solo leyendo, sección 4).
- **`use_fedcm_for_prompt: true`** en `initialize`.
- **Sin sumar a la carga inicial:**
  - El componente `IngresoGoogle` va en un bloque aparte (`lazy`).
  - El script `https://accounts.google.com/gsi/client` se pide recién al montarlo, en Ingresar o Registrarse.
  - Medido en la sección 3.
- **Respaldo:** si el script no carga (error o más de 10 s), carga sin la API o falla al dibujar el botón, la pantalla muestra el botón de antes, que sigue con `signInWithOAuth` y PKCE.
  - Pasa lo mismo sin `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
  - En la app nativa, siempre el de antes: no cambia.
- **Navegadores de WhatsApp, Instagram y Facebook:** ni el botón ni el respaldo, porque Google los rechaza (`disallowed_useragent`).
  - En su lugar, el mensaje "Para entrar con Google, abrí este link en Chrome o Safari: Google no deja hacerlo desde el navegador de WhatsApp. Con email y contraseña podés seguir acá."
  - Debajo, el link de la pantalla (seleccionable) y "Copiar el link".
  - La detección es la de "Instalar la app" (`appConNavegador`).
  - El ingreso con email sigue igual.
- **CSP (modo reporte):** suma `https://accounts.google.com/gsi/client` (script), `https://accounts.google.com/gsi/style` (estilo) y `https://accounts.google.com/gsi/` (iframe y conexiones). Nada más de ese origen.
- **Después de entrar, lo de siempre:**
  - la sesión la guarda el mismo cliente de Supabase;
  - el perfil lo crea `handle_new_user`;
  - quien no aceptó los términos los acepta con `AceptarTerminos` y `aceptar_terminos`, como quien entraba con Google antes.

  No se tocó nada de eso.
- **Pruebas:** `__tests__/google.test.ts` (11 pruebas) y una más de la CSP en `__tests__/indexHtml.test.ts`. Además, un recorrido en Chromium contra el build y un Supabase simulado (sección 3).

**Decisiones** (detalle en `docs/DECISIONES.md`, "Ingresar con Google: el botón de Google"):
- **La variable va solo en Production.** Google pide cada origen exacto, sin comodines, y cada vista previa de Vercel tiene su dirección: en las vistas previas se ve el botón de respaldo.
- **El texto y los colores del botón los pone Google.** Es la única parte de esas pantallas que no sale de `es-UY.ts` ni de `tema.ts`: Google pide usar su botón sin cambiarlo. Quedó anotado como excepción en `AGENTS.md`.

## 2. Cambios

**Código**
- `src/features/auth/google.ts` (nuevo): reglas puras y la llamada a Supabase.
  - `formaDeIngresarConGoogle` elige qué mostrar: `boton`, `cargando`, `respaldo` o `abrirEnNavegador`.
  - `crearNonce`, `hashDelNonce` y `prepararNonce` arman el nonce y su hash SHA-256.
  - `ingresarConTokenDeGoogle` llama a `signInWithIdToken` con `provider: 'google'`, el token y el nonce original. El error llega en español con `traducirError`.
- `src/features/auth/scriptGoogle.ts` (nuevo): el cargador del script de Google, sin React y con un entorno inyectable para las pruebas.
  - Lo pide una sola vez y reusa la API si ya está.
  - Falla con error, sin la API o a los 10 s (`ESPERA_GOOGLE_MS`). Al fallar saca el `<script>` y deja intentar de nuevo.
  - Tipos de lo que se usa de `google.accounts.id`.
- `src/components/auth/IngresoGoogle.web.tsx` (nuevo): el bloque de Google en web.
  - Carga el script y el nonce, llama a `initialize` (con el ID de cliente, el hash del nonce y `use_fedcm_for_prompt`) y dibuja el botón con `renderButton`.
  - Dibuja en el cuadro siguiente al layout y de nuevo si cambia el ancho o el esquema.
  - El lugar del botón ocupa 40 de alto desde el principio, para que nada salte.
  - Mientras se ingresa, queda a media opacidad, sin tocarse y con el indicador.
  - Muestra el error de Google en español (`mensajeDeError`), el respaldo o el aviso del navegador interno con el link y "Copiar el link".
- `src/components/auth/IngresoGoogle.tsx` (nuevo): la versión nativa, que es el botón de respaldo. También define las props comunes.
- `src/components/auth/BotonGoogleRespaldo.tsx` (nuevo): el botón de antes ("Continuar con Google", `secundario`, `logo-google`) con su estado de carga y error. Usa `ingresarConGoogle` (`signInWithOAuth`).
- `src/components/auth/Acceso.tsx`: `SeparadorO`, la línea con "o" que antes estaba solo en Ingresar, para usarla en las dos pantallas.
- `src/app/auth/ingresar.tsx`: el botón de Google y su separador pasan a `SeparadorO` y a `IngresoGoogle`, cargado con `lazy`. Se sacaron los estilos y los imports que ya no se usan.
- `src/app/auth/registrarse.tsx`: suma `SeparadorO` e `IngresoGoogle` (`lazy`) debajo de "Crear cuenta".
- `src/i18n/es-UY.ts`: `t.auth.google.navegadorInterno`.
- `src/lib/env.ts`: `ENV.googleClientId`, de `EXPO_PUBLIC_GOOGLE_CLIENT_ID`; `null` si falta.
- `.env.example`: la variable, vacía y comentada.
- `vercel.json`: la CSP en modo reporte, con las rutas de Google Identity Services.

**Pruebas**
- `__tests__/google.test.ts` (nuevo):
  - **El nonce:** 64 hexadecimales, distinto cada vez; el hash es el SHA-256 conocido de `abc`; `prepararNonce` da el hash del original.
  - **Qué se muestra:** el botón, cargando o el respaldo (con el script que falló, sin ID de cliente, en Android e iOS). En WhatsApp, Instagram y Facebook, abrir en el navegador aunque falte el ID o falle el script.
  - **El cargador:** pide `https://accounts.google.com/gsi/client` una vez, `async`; si falla, saca el script y deja reintentar; falla si carga sin la API o si pasa el tiempo.
  - **El ingreso:** llama a `signInWithIdToken` con `provider: 'google'`, el token y el nonce original (y el SHA-256 de lo enviado es el hash que recibió Google). Un 429 de Supabase llega como "muchos intentos".
- `__tests__/indexHtml.test.ts`: la CSP permite el script, el estilo, el iframe y las conexiones de Google Identity Services, y nada más de `accounts.google.com`.

**Documentación**
- `docs/DECISIONES.md`: la entrada "Ingresar con Google: el botón de Google".
- `docs/ARQUITECTURA.md`: Sesión, un punto nuevo "Google (web)", seguridad (el ID de cliente y lo que valida Supabase), carga inicial (el bloque aparte), Vercel (la variable, solo Production) y la lista de pruebas.
- `docs/DISENO.md`, 7.7: la línea con "o", el botón de Google, el respaldo y el aviso de los navegadores internos.
- `AGENTS.md`:
  - la regla nueva "Ingresar con Google (web)";
  - las excepciones de colores y textos del botón de Google;
  - las rutas de Google en la CSP;
  - la variable en la configuración pendiente.
- `README.md`:
  - el paso de Google (orígenes autorizados, Client IDs, Skip nonce checks);
  - la variable en la lista y en Vercel;
  - "Cómo probar": Ingresar con Google con el botón de Google.
- `docs/PRUEBAS-MANUALES.md`: la marca **[Google]** y el paso 34, el flujo nuevo, que cubre:
  - la carga y el botón, en claro y en oscuro;
  - la ventana de Google y los términos;
  - Registrarse;
  - WhatsApp e Instagram;
  - el respaldo con Google bloqueado;
  - la consola.
- `docs/reportes/2026-10-25-google-boton.md`: este reporte.

## 3. Verificaciones

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos (solo el aviso de `synckit` de Node, de siempre). |
| `npm run test` | 32 suites y 353 pruebas en la rama del PR, todas pasan (346 con solo este cambio sobre `main`). |
| `npx expo export -p web` | Termina bien. `index.html` no nombra a Google. El script de Google aparece solo en el bloque `IngresoGoogle`. |

**Carga inicial** (gzip, el build de esta rama contra el de `main`):

| Bloque | `main` | Ahora |
|---|---|---|
| `entry` | 290 752 B | 290 749 B |
| `__common` | 190 717 B | 190 962 B (+245 B) |
| `IngresoGoogle` (nuevo, solo en Ingresar y Registrarse) | — | 2 842 B |
| `ingresar` | 1 151 B | 1 055 B |
| `registrarse` | 1 055 B | 1 232 B |

- **Lo que suma `__common`:** el texto del navegador interno (`es-UY.ts`), la variable de `env.ts` y la línea con "o" de `Acceso.tsx`. Nada de Google.
- **El script de Google** no se pide hasta abrir Ingresar o Registrarse.

**Recorrido en Chromium (Playwright)**, contra el build con un ID de cliente de prueba, un Supabase simulado que acepta `grant_type=id_token` y compara el SHA-256 del nonce con el del token, y un script de Google simulado. 17 de 17:
- **El script:** la carga inicial (el mapa) no pide nada a `accounts.google.com`; Ingresar pide `gsi/client`.
- **`initialize`:** recibe el ID de cliente, `use_fedcm_for_prompt: true` y un nonce de 64 hexadecimales (el hash).
- **`renderButton`:** recibe `standard`, `continue_with`, `pill`, `large`, `outline`, `es-419` y el ancho de la columna (342).
- **El ingreso:**
  - Al tocar el botón, Supabase recibe `provider: google`, el token de Google y el nonce original. El SHA-256 del nonce coincide con el del token (el simulado responde 200).
  - La sesión queda abierta e Ingresar se cierra solo.
- **Respaldo:** con el script bloqueado, aparece el botón de siempre.
- **Navegador de WhatsApp:**
  - Se ve el aviso y el link.
  - No se pide el script ni aparece el botón de siempre.
  - "Copiar el link" copia `…/auth/ingresar`.
- **Registrarse** muestra el botón; en oscuro va `filled_black`.

**El script real de Google** (bajado aparte y servido al navegador de la prueba):
- Dibuja "Continuar con Google" en español, en píldora, con borde en claro y negro en oscuro.
- Con un ID de cliente de prueba (y con un origen no autorizado), el iframe del botón responde 403. Es el riesgo de la sección 5.

**Lo que no se pudo correr acá:**
- Un ingreso real con una cuenta de Google: la red de esta sesión no llega a Supabase ni a Google desde el navegador.
- `npm run e2e`: los flujos ingresan con email, y este cambio no los toca.
- Los dos quedan en el paso 34 de `docs/PRUEBAS-MANUALES.md`.

## 4. Pasos manuales

No hace falta SQL ni migración. Lo que ya está en producción (leído con la API de Supabase, sin cambiar nada):
- el proveedor de Google está activado;
- "Skip nonce checks" está apagado;
- hay un ID de cliente con forma de cliente web en "Client IDs";
- hay un secreto cargado;
- el captcha está apagado;
- el Site URL es `spot-uy.vercel.app`.

En este orden:

1. **Google Cloud** (el mismo cliente OAuth "Web application" que ya usa Supabase):
   - **Dónde:** Google Cloud Console → Google Auth Platform → **Clients** (o APIs & Services → Credentials) → el cliente web.
   - **Authorized JavaScript origins:** agregá, sin barra al final:
     - `https://spot-uy.vercel.app`
     - `http://localhost`
     - `http://localhost:8081`

     Google pide `http://localhost` y `http://localhost:<puerto>` para probar en local.
   - **Authorized redirect URIs:** dejá `https://bwqvuttuodwypwxckxgf.supabase.co/auth/v1/callback`, porque lo usa el botón de respaldo.
   - **Branding:** que el nombre de la app sea "Spot" (es lo que muestra la ventana de Google).
   - **Guardá.** Google avisa que puede tardar unos minutos en aplicarse.
2. **Supabase:** **Authentication → Sign In / Providers → Google**. Confirmá que en **Client IDs** esté el mismo client ID web del paso 1 (ya hay uno cargado) y que **Skip nonce checks** siga apagado. No cambies nada más.
3. **Vercel, el paso de cierre:** cargá `EXPO_PUBLIC_GOOGLE_CLIENT_ID` con el client ID web (termina en `.apps.googleusercontent.com`; es público), **solo en Production**.
   - **Desde el panel:** Project → **Settings → Environment Variables → Add**, Key `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, Environment **Production**.
   - **O con la CLI:**

     ```bash
     npx vercel env add EXPO_PUBLIC_GOOGLE_CLIENT_ID production
     ```

     Pide el valor, que se pega en la terminal, no en el repo.
4. **Deploy:** la variable va dentro del build.
   - Si la cargás antes de mergear el PR, el deploy de `main` ya la toma.
   - Si la cargás después, **Deployments → el último de Production → Redeploy** (sin "Use existing Build Cache").
5. **Probar:** el paso 34 de `docs/PRUEBAS-MANUALES.md`, en Chrome (computadora y Android), Safari (iPhone) y desde un link en WhatsApp.
   - En la consola no tiene que aparecer "The given origin is not allowed for the given client ID". Si aparece, falta el origen del paso 1.
   - Si el botón falla, sacar la variable de Vercel y hacer Redeploy vuelve al botón de siempre.

## 5. Pendientes y riesgos

- **Un origen sin autorizar rompe el botón sin respaldo.** Si el sitio no está en "Authorized JavaScript origins", el script de Google carga y dibuja su botón, pero el botón no anda: Google responde 403 dentro de su iframe. La app no se entera, así que no cae al respaldo. Por eso el orden de la sección 4: primero Google Cloud, después la variable. Para volver atrás, sacar la variable y hacer Redeploy.
- **Las vistas previas de Vercel usan el respaldo:** no se pueden autorizar con comodines. Para probar el botón en una vista previa, agregá su dirección exacta en Google Cloud y la variable para ese entorno, y sacalas después.
- **Otros navegadores internos** (TikTok, LinkedIn, X, Telegram…) no se detectan: muestran el botón y Google puede rechazarlos. Hoy se detectan WhatsApp, Instagram, Facebook y Messenger, que es por donde llegan los links. Se suman en `appConNavegador` si aparecen.
- **FedCM:** Chrome muestra la ventana de cuentas del navegador; Safari y Firefox, la de Google. Hay que probar las dos (paso 34).
- **El texto del botón no sale de `es-UY.ts`:** lo pone Google y puede cambiarlo. Si Google cambia su script de forma que deje de cargar, la app cae al respaldo. Si carga pero cambia su comportamiento, no.
- **La app nativa no cambia:** sigue con `signInWithOAuth`, y su pantalla de Google sigue mostrando la dirección de Supabase. Para cambiarla hace falta el SDK nativo de Google, que queda para la etapa de tiendas.
- **Nada más se agregó:** ni One Tap ni el aviso automático de Google al abrir la página (`prompt()`). `use_fedcm_for_prompt` queda puesto por si se suma.
- **La CSP sigue en modo reporte:** si Google pide otra ruta, se ve como `[Report Only]` en la consola (paso 34) y hay que sumarla antes de pasar la CSP a obligatoria.
- **`__common` sumó 245 B comprimidos:** el texto, la variable y la línea con "o", que van en todas las páginas. El código y el script de Google, no.
- **La rama:** el pedido era partir de `main`, y el cambio se hizo y se verificó sobre `main`. Como el PR #20 (de la rama de trabajo de siempre) sigue abierto, el commit va encima de él, como los dos cambios anteriores.

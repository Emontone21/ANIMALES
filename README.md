# Spot · animales perdidos y encontrados en Montevideo

App para reunir perros y gatos perdidos con sus familias. La familia que perdió un animal lo publica en un mapa con una foto, y quien encuentra uno, también; otras personas avisan que lo vieron en otro lugar, que lo resguardaron o que ya volvió a su casa. La app compara las fotos y sugiere cuándo dos reportes podrían ser el mismo animal; una persona confirma, nunca se unen solos. Hay mensajería interna para hablar sin compartir datos personales, notificaciones y un panel de moderación. Cada persona maneja su cuenta (contraseña, perfil, borrado) y se protege de otros usuarios (bloqueos, términos, resguardo de perdidos con foto). Quien publica puede corregir o borrar su reporte, y cualquiera lo puede compartir con una vista previa que muestra la foto del animal. La web se puede instalar como app, y cualquiera puede reportar un error a moderación desde Perfil.

Interfaz en español rioplatense. Stack: Expo + React Native + TypeScript (corre en el navegador y, con el mismo código, como app nativa), Supabase en la nube (Auth, Postgres con PostGIS y pgvector, Storage), mapas MapLibre con teselas gratuitas de OpenFreeMap, reconocimiento de imágenes con la API de Claude (Anthropic) desde una Edge Function de Supabase. Se despliega en Vercel.

Estado: las fases 1 a 8 están implementadas (la 5 endureció permisos, la 6 sumó los perdidos, la 7 la cuenta y la protección de usuarios y la 8 la gestión de casos y compartir). La Fase 9 fue una revisión integral: correcciones, pruebas automáticas de la app y una lista de pruebas manuales ([docs/PRUEBAS-MANUALES.md](docs/PRUEBAS-MANUALES.md)). Después vinieron la carga inicial más rápida, las mejoras (hoja "Cerca tuyo" plegable, instalar la app y reportar un error) y el reconocimiento con la API de Claude. Para el piloto, la app pasó a llamarse Spot, con mails propios, captcha opcional y la clave publishable de Supabase, y después llegó su logo, una chapita de collar. Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [docs/DECISIONES.md](docs/DECISIONES.md).

Todo corre en la nube: no hace falta Docker ni Android Studio. Solo Node 20+ para desarrollar.

## Puesta en marcha

### 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratuito). Guardá la contraseña de la base.
2. Copiá la **Project URL** (botón **Connect**) y, en **Settings → API Keys**, la clave **publishable** (`sb_publishable_…`). La **anon** legacy sirve de respaldo mientras Supabase la acepte (hasta fin de 2026). El reconocimiento no necesita copiar claves de Supabase: la función usa la que Supabase le pone en su entorno (paso 5).
3. Aplicá las migraciones de `supabase/migrations/` **en orden** (0001 a 0022). Dos formas:

   **a) CLI** (sin instalar nada):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```

   El `<ref>` está en la URL del dashboard (`supabase.com/dashboard/project/<ref>`).

   **b) Dashboard:** SQL Editor → pegá y ejecutá cada archivo, uno por uno, en orden. La 0009 y la 0015 van solas: agregan un valor a un enum que la siguiente usa, y Postgres no deja usarlo en la misma ejecución. La 0016 crea el bucket privado `capturas` (Storage); no hay que crearlo a mano.

4. Datos de demo (opcional): ejecutá `supabase/seed.sql` en el SQL Editor. Crea `demo@encontrados.uy` / `demo1234`, tres animales encontrados y un perro perdido (Toby) cerca del de Parque Rodó. La demo acepta los términos la primera vez que publica, escribe o denuncia. Cambiá la contraseña de la demo antes de abrir la web al público.
5. **Authentication → URL Configuration:** Site URL = tu URL de Vercel (cuando la tengas), sin barra al final: los links de los mails van a `<Site URL>/auth/confirmar` (`supabase/templates/README.md`). Redirect URLs: `http://localhost:8081/**`, `https://<tu-sitio>.vercel.app/**`, `spotmvd://**`. Las usan Google y los links de los mails viejos, que volvían a `/auth/nueva-contrasena`. No agregues comodines en el nombre del sitio (como `https://*-<equipo>.vercel.app/**`): cualquiera puede crear un sitio en `vercel.app` que termine igual, y un link de recuperación que vuelva ahí le entrega la sesión. Si necesitás probar en una preview, agregá su URL exacta y sacala después.
6. **Mails:** configurá un SMTP propio (**Authentication → Emails → SMTP Settings**; el servidor gratuito manda pocos mails por hora) y cargá las plantillas en español de `supabase/templates/` (confirmar la cuenta, recuperar la contraseña, cambiar el email y enlace mágico), con los pasos de su [README](supabase/templates/README.md).
7. **Captcha (opcional, recomendado al abrir al público):** Cloudflare Turnstile al registrarse, ingresar y recuperar la contraseña. El orden importa: primero la app con la clave del sitio, después el captcha en Supabase (si no, nadie puede ingresar). Pasos en `docs/reportes/2026-10-21-spot-piloto.md`, sección 4.
8. Google (opcional): cliente OAuth **Web application** en Google Cloud con redirect `https://<ref>.supabase.co/auth/v1/callback` (el botón de respaldo) y, en **Authorized JavaScript origins**, el sitio sin barra al final (`https://<tu-sitio>.vercel.app`) y `http://localhost:8081` (el botón de Google; cada origen exacto, sin comodines). Pegá client ID y secret en **Authentication → Providers → Google**, con el mismo client ID en **Client IDs** y **Skip nonce checks** apagado. El client ID va también en `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (paso 2).
9. Moderadores (opcional): `update perfiles set es_moderador = true where id = '<uuid>';`. Reciben en Actividad los reportes de errores y los ven en **Moderación → Errores**. Los límites de esos reportes están en `config_app` (`errores_por_hora_cuenta`, 5, y `errores_por_hora_sin_cuenta`, 30).
10. Pruebas (opcional, recomendado después de cada migración): corré en el SQL Editor los archivos de `supabase/tests/` (ver su README). Terminan en `Success. No rows returned` y no dejan datos.

### 1b. Proyecto de pruebas (spot-pruebas)

Un segundo proyecto de Supabase, gratuito, para probar antes de tocar producción: `soafsmktmfmryeiixmpo` (en el panel de Supabase se llama ReplicaANIMALES). Tiene las mismas migraciones, el seed y la configuración de producción, salvo:
- el reconocimiento apagado (`config_app.ia_activa = 'false'`, sin `vision_url`);
- sin captcha;
- la confirmación de email apagada (**Authentication → Sign In / Providers → Email → Confirm email**), así las pruebas crean cuentas sin mails;
- sin SMTP propio ni Google, y por eso con las plantillas de mail de Supabase: en el plan gratis no se cambian sin SMTP propio;
- Site URL `http://localhost:8081` y Redirect URLs locales (`http://localhost:8081/**`, `http://localhost:4173/**`, `http://127.0.0.1:4173/**`, `spotmvd://**`).

**Regla: cada migración se prueba primero acá.**
1. Aplicala en el proyecto de pruebas:
   ```bash
   npx supabase link --project-ref soafsmktmfmryeiixmpo
   npx supabase db push
   ```
   O en su SQL Editor, como en el paso 1.3 b, registrándola en `supabase_migrations.schema_migrations`.
2. Corré ahí todas las pruebas de `supabase/tests/` y `npm run e2e` (sección "Pruebas de punta a punta").
3. Recién con todo en verde, aplicala en producción (`npx supabase link --project-ref bwqvuttuodwypwxckxgf` y `npx supabase db push`, o el SQL Editor) y volvé a correr las pruebas SQL allá.

Lo que escribe o ataca (pruebas de punta a punta, pruebas de seguridad) va siempre contra este proyecto, nunca contra producción. Si se ensucia, se puede vaciar y volver a cargar: migraciones 0001 a la última, `supabase/seed.sql` y los ajustes de arriba.

### 2. Variables de entorno

```bash
cp .env.example .env
```

Completá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o, de respaldo, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; si están las dos, se usa la publishable). En Vercel van en **Settings → Environment Variables**. Opcionales:
- `EXPO_PUBLIC_SITE_URL`: la base de los links que se comparten (`<sitio>/animal/<id>`); si falta, `https://spot-uy.vercel.app`.
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`: la clave del sitio de Cloudflare Turnstile; sin ella no hay captcha.
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY`: la clave VAPID pública de las notificaciones en el celular (paso 6); sin ella la app no las ofrece.
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`: el ID de cliente web de Google (público). Con él, Ingresar y Registrarse muestran el botón oficial de Google, que no pasa por la dirección de Supabase; sin él, el botón de siempre (`signInWithOAuth`). Necesita el sitio en los orígenes autorizados de Google (paso 1.8).

### 3. Correr la web

```bash
npm install
npx expo start --web
```

Abre `http://localhost:8081`. En PowerShell, si `npx` está bloqueado por la política de scripts, usá `npx.cmd`.

### 4. Vercel

1. En [vercel.com](https://vercel.com) → **Add New Project** → importá `Emontone21/ANIMALES`. En **Framework Preset** elegí **Other**: Vercel suele detectar **FastAPI** por el servicio de visión en `services/vision/` y el build falla en `uv pip install`. `vercel.json` ya trae build (`npx expo export -p web`, con el commit del deploy y la fecha como versión para los reportes de errores) y salida (`dist`). El commit sale de `VERCEL_GIT_COMMIT_SHA`: dejá activado **Settings → Environment Variables → Automatically expose System Environment Variables** (viene así); si no, la versión dice la fecha del build. Si el proyecto ya existe, se cambia en **Settings → Build and Deployment → Framework Preset**.
2. Cargá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o la anon, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), y opcionalmente `EXPO_PUBLIC_MAP_STYLE_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY` y `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, para Production y Preview, y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` solo para Production (las previews no son orígenes autorizados de Google: usan el botón de respaldo). Cambiar una variable pide un deploy nuevo: van dentro del build.
3. Deploy. Cada push a `main` redeploya. Volvé a Supabase y poné la URL de Vercel como Site URL.

Además de la web estática, Vercel publica una función: `api/vista-previa.ts`. `vercel.json` le manda solo a los bots de vista previa (WhatsApp, Facebook, Telegram…) los pedidos de `/animal/<id>`, y la función devuelve el `index.html` con la foto y el título del caso. Usa las mismas variables `EXPO_PUBLIC_*`, no necesita otras. `.vercelignore` deja afuera `services/`, para que Vercel no vuelva a detectar Python.

### 5. Servicio de reconocimiento

Claude mira las fotos desde la Edge Function `supabase/functions/reconocer` (detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), "Reconocer"):
1. Aplicá las migraciones 0017 a 0020 (el trabajo de pg_cron, lo del reconocimiento con IA, el texto de sus errores y las coincidencias solo con veredicto "mismo" o "posible").
2. **Clave de Anthropic:** en [console.anthropic.com](https://console.anthropic.com) → **API Keys**, creá una clave, y cargala en Supabase → **Edge Functions → Secrets** con el nombre `ANTHROPIC_API_KEY`. No la pegues en ningún archivo ni en un chat. Conviene un límite de gasto mensual en la consola de Anthropic.
3. **Desplegá la función,** desde la raíz del repo (sin Docker):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase functions deploy reconocer --use-api --no-verify-jwt
   ```
4. **Conectala** en el SQL Editor. El secreto lo genera la base y nadie lo ve: la función lo lee de ahí. Tiene que ser así, 32 bytes en hexadecimal (64 caracteres): la función rechaza sin consultar la base un secreto con otra forma.
   ```sql
   update config_app set valor = 'https://<ref>.supabase.co/functions/v1/reconocer', updated_at = now() where clave = 'vision_url';
   update config_app set valor = encode(extensions.gen_random_bytes(32), 'hex'), updated_at = now() where clave = 'vision_secret';
   ```

Sin este paso la app funciona igual; solo no aparecen "posibles coincidencias". El estado, las llamadas de hoy y el costo del mes se ven en **Moderación → Reconocimiento**. El servicio de embeddings en Python (`services/vision`) queda como alternativa sin desplegar.

### 6. Notificaciones en el celular

Las novedades se ven en **Actividad** sin configurar nada. Para que además lleguen como notificación del celular en la web (Android, computadora y iPhone con la app instalada), la Edge Function `supabase/functions/avisar` las manda con Web Push (detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), "Notificaciones en el celular"):

1. Generá un par de claves VAPID (P-256) sin guardarlas en archivos y cargalas: la pública y la privada como secretos de la función (`npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=…`, en base64url: la pública, los 65 bytes del punto; la privada, los 32 del escalar) y la pública también en Vercel (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`). Opcional: `VAPID_SUBJECT` (por defecto, el sitio).
2. Desplegá la función:
   ```bash
   npx supabase functions deploy avisar --use-api --no-verify-jwt
   ```
3. Con la migración 0024 aplicada, en el SQL Editor (el secreto, 32 bytes en hexadecimal; no lo guardes en ningún archivo):
   ```sql
   update config_app set valor = 'https://<ref>.supabase.co/functions/v1/avisar', updated_at = now() where clave = 'avisar_url';
   update config_app set valor = encode(extensions.gen_random_bytes(32), 'hex'), updated_at = now() where clave = 'avisar_secret';
   ```
4. Redeploy de Vercel (la clave pública va dentro del build).

El tope por persona y por hora es `config_app.avisos_push_por_hora` (6). Sin la función configurada, nada cambia: los avisos quedan en Actividad.

Para push en la app nativa (Android/iOS) hace falta un proyecto de EAS (`npx eas-cli init`, que agrega `extra.eas.projectId` a `app.json`) y un development build.

## Scripts

| Comando | Qué hace |
|---|---|
| `npx expo start --web` | Servidor de desarrollo web |
| `npx expo export -p web` | Build estático en `dist/` (lo que corre Vercel) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier |
| `npm run test` | Pruebas de la lógica de la app y de la vista previa (jest-expo, `__tests__/`) |
| `npm run e2e` | Pruebas de punta a punta en el navegador, contra el proyecto de pruebas (abajo, "Pruebas de punta a punta") |
| `deno test --allow-env` (en `supabase/functions/reconocer`) | Pruebas de la función de reconocimiento, con la API de Claude simulada |
| `deno test --allow-env` (en `supabase/functions/avisar`) | Pruebas de la función de notificaciones, con un servicio de push simulado |
| `deno run … scripts/evaluar-ia.ts` | Evalúa el reconocimiento con fotos de animales conocidos y la API real (ver el reporte de la tarea). Guardá las fotos en `evaluar-fotos/` y la salida como `evaluacion*.json`: git los ignora |
| `pytest` (en `services/vision`) | Pruebas del servicio de embeddings (sin desplegar), con un modelo falso: `pip install -r requirements-pruebas.txt` |
| `python3 scripts/iconos-web.py` | Íconos de la web (`public/iconos/`) desde `assets/images/icon.png` (ver `docs/DISENO.md`, "Ícono de la app") |
| `node scripts/plantillas-mail.js` | El JSON para cargar las plantillas de mail con la API de gestión (`supabase/templates/README.md`) |
| `npm run format` | Formatea `src/` |
| `npm run db:push` | Sube migraciones al proyecto enlazado |
| `npm run db:types` | Regenera `src/types/database.ts` desde el proyecto enlazado; si falla, no toca el archivo |

## Pruebas de punta a punta

`npm run e2e` corre los flujos principales de `docs/PRUEBAS-MANUALES.md` que no necesitan cámara, mail real, Google ni teléfono, con Playwright, en tamaño de teléfono y de computadora: publicar un perdido y un encontrado con foto, activar las notificaciones del celular (con el push del navegador simulado) y una notificación de verdad del service worker, compartir en historias, "Lo vi", resguardar con foto, reunido, contar cómo volvió y agradecer, el muro de reencuentros, mensajes, bloquear, denunciar y moderar, editar y borrar, compartir, perfil, reportar un error y borrar la cuenta. Falla si el navegador muestra un error en la consola.
- **Siempre contra el proyecto de pruebas** (sección 1b), nunca contra producción: si la URL es la de producción, no arranca.
- **Variables** (en tu terminal, nunca en un archivo del repo): `E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY` (o `E2E_SUPABASE_ANON_KEY`) y `E2E_SUPABASE_SECRET_KEY`, todas del proyecto de pruebas (Supabase → **Project Settings → API Keys**). La secreta solo se usa para crear y borrar las cuentas de prueba y sus fotos.
- **Qué hace:** arma la web apuntada al proyecto de pruebas (`e2e/.dist`), la sirve en `http://localhost:4173`, crea dos cuentas de prueba por tamaño (familia y vecina), corre los flujos y al final borra las cuentas y sus fotos.
- **Detalle,** opciones (sin volver a armar la web, con proxy) y qué hacer si falla: `e2e/LEEME.md`.
- **Estado:** quedó lista en la auditoría 2 y todavía no se corrió contra el proyecto de pruebas; la primera corrida puede pedir ajustar algún selector.

## Cómo probar cada fase

Para recorrer toda la app en unos 65 minutos, en Android, iPhone y computadora, seguí [docs/PRUEBAS-MANUALES.md](docs/PRUEBAS-MANUALES.md). Lo que sigue es el detalle por fase.

Todo en el navegador. Conviene tener dos cuentas: la demo (`demo@encontrados.uy` / `demo1234`) y una tuya.

**Fase 1 · mapa y publicación**
1. Sin cuenta: mapa de Montevideo con los animales de demo. Chips por tipo y, en **Más filtros**, especie, estado y antigüedad. Clic en un marcador muestra su foto y pone su tarjeta primera en **Cerca tuyo**; la tarjeta abre el detalle.
2. En **Publicar** te pide cuenta. Creá una con email o entrá con la demo.
3. **Publicar → Encontré un animal**: foto, datos, "¿cuándo lo viste?" y ubicación (GPS o punto en el mapa). Caés en el detalle y el animal aparece en el mapa.

**Fase 2 · interacciones**
1. Con tu cuenta, abrí un animal de la demo y tocá **Lo vi**: foto, cuándo, dónde, nota. El historial suma una fila y el mini mapa dibuja el recorrido; tocándolo se abre en grande, con cada punto numerado. En el mapa principal, al seleccionar el animal, se ve la línea entre avistamientos.
2. **Me lo llevé / está resguardado**: escribí un contacto opcional. El estado cambia, el contacto se ve en el detalle y queda en el historial. **Se volvió a escapar** lo reabre; en un encontrado, solo lo pueden decir quien lo publicó y quien lo resguarda.
3. **Se reunió con su familia** cierra el caso (deja de estar en "Activos"). En un encontrado lo pueden marcar quien lo publicó y quien lo tiene resguardado; reabrirlo, solo quien publicó.
4. **Seguir** y **Denunciar** (motivo + detalle). Tres denuncias de cuentas distintas con al menos 7 días ocultan la publicación.

**Fase 3 · reconocimiento**
1. Con el reconocimiento configurado, publicá dos reportes con fotos del mismo animal a pocas cuadras y con poca diferencia de tiempo.
2. En un minuto (unos segundos más si el servicio estaba apagado) el detalle muestra **Posibles coincidencias** con el porcentaje de parecido, distancia y tiempo. Se refresca solo cada 30 s.
3. Entre dos encontrados deciden quien publicó cualquiera de los dos o un moderador. **Es el mismo animal** une los reportes: el más viejo queda como principal y el otro redirige a él. **No es el mismo** lo descarta y queda registrado para calibrar el umbral (`config_app.umbral_similitud`).

**Fase 6 · reportes de perdidos**

Necesitás tres cuentas: la familia, alguien que encuentra y un tercero.
1. Sin cuenta: en el mapa, los chips **Todos · Perdidos · Encontrados** filtran por tipo; la especie quedó en **Más filtros**. Toby (seed) tiene el anillo naranja y un halo que lo distingue también en escala de grises.
2. Con la familia: **Publicar → Perdí a mi animal**. Cargá foto, especie, nombre, tamaño, color, collar, señas, "¿Cuándo se perdió?" (en días) y dónde lo vieron por última vez; el formulario avisa que no hace falta la casa exacta. Opcional: un contacto para mostrar. En el detalle: el nombre primero, **Perdido desde el …**, la etiqueta naranja **Perdido** y, si cargaste contacto, **Lo buscan** junto al aviso contra estafas. El punto guardado está redondeado a unos 100 m.
3. Con el tercero, en ese perdido: **Lo vi** y **Me lo llevé / está resguardado** funcionan (resguardarlo pide una foto actual); **Se reunió con su familia** y **Se volvió a escapar** no aparecen. Con la familia, sí.
4. Con quien encuentra: **Publicar → Encontré un animal** con una foto parecida, cerca y después de la pérdida. Con el reconocimiento andando aparece la coincidencia, con el motivo: la familia recibe "Encontraron un animal parecido a <nombre>" y es la única que ve **Es el mismo animal** y **No es el mismo**; el resto ve "Su familia está mirando las fotos…". Al confirmar, el perdido queda como principal; si el encontrado estaba resguardado, el perdido pasa a resguardado con ese contacto.
5. En un encontrado, **Se reunió con su familia** lo ven quien lo publicó y quien lo tiene resguardado.

Las mismas reglas, probadas directo en la base: `supabase/tests/fase6_perdidos.sql`.

**Fase 7 · cuenta y protección de usuarios**

Conviene tener tres cuentas: A y B con email, y C que entra con Google (o una cuenta vieja que todavía no aceptó los términos).
1. **Recuperar la contraseña:** en **Ingresar**, tocá **¿Olvidaste tu contraseña?** y escribí el email de A. El mensaje es el mismo exista o no la cuenta. El mail trae un link que abre **Elegí una contraseña nueva**; guardala y quedás adentro. Si usás el link de nuevo, dice que ya no sirve y ofrece pedir otro.
2. **Términos:** **Perfil → Términos y privacidad** abre los dos borradores, también sin cuenta. Al crear una cuenta la casilla es obligatoria. Con C, **Publicar**, **Lo vi**, **Escribir** y **Denunciar** piden aceptar antes; después siguen solos.
3. **Editar el perfil:** **Perfil → Editar perfil**: cambiá el nombre (2 a 40) y la foto. La foto aparece en Perfil y en la lista de bloqueados de quien te bloquee.
4. **Bloquear:** con A, en una conversación con B, **Más opciones → Bloquear a B**. B ya no puede escribirle ni abrir conversaciones nuevas con A, y A deja de recibir avisos de B. En **Perfil → Personas bloqueadas**, **Desbloquear** lo deshace.
5. **Resguardo de un perdido:** con B, en un perdido de A, **Me lo llevé / está resguardado** pide una foto actual. El contacto que deje B lo ven A y B; C ve "Alguien avisó que lo tiene" y no ve el contacto, tampoco por la API.
6. **Denuncias de cuentas nuevas:** tres denuncias de cuentas creadas hace menos de 7 días no ocultan nada. En el panel de moderación esas denuncias llevan la etiqueta **Cuenta nueva**.
7. **Borrar la cuenta:** con B, **Perfil → Borrar mi cuenta**. Si B tiene perdidos publicados, la pantalla avisa que se borran siempre. Elegí si sus encontrados abiertos y lo que aportó a casos de otros quedan publicados sin su nombre (por defecto) o se borran, marcá que entendés y confirmá. Volvés al mapa sin sesión. Los casos que quedaron dicen "una cuenta eliminada" en el historial, sin botón para escribir.

Todas las reglas, probadas directo en la base: `supabase/tests/fase7_cuenta.sql`.

**Fase 8 · gestión de casos y compartir**

Conviene tener dos cuentas: la que publica y otra.
1. **Miniaturas:** publicá un caso. En Supabase, **Storage → fotos → <tu uid>**, quedan dos archivos: `<uuid>.jpg` y `<uuid>.miniatura.jpg` (320 × 320). En el mapa cada marcador lleva su foto: los perdidos con anillo naranja y halo, los encontrados con anillo oliva y los cerrados más claros; el seleccionado es más grande. Las tarjetas, **Cerca tuyo**, **Mis reportes** y los avatares cargan la miniatura (en la pestaña Red del navegador se ve `.miniatura.jpg`). Las fotos de antes de esta fase y los datos de demo muestran la original.
2. **Editar:** en tu reporte, **Más opciones → Editar el reporte**. Cambiá el color, el tamaño o la descripción (en un perdido, también el nombre y el contacto) y tocá **Guardar cambios**: volvés al detalle con los datos nuevos. La foto, la ubicación y el tipo no se editan. Con la otra cuenta, **Más opciones** no muestra Editar ni Borrar. Si cambiás la especie, las coincidencias pendientes desaparecen y las fotos vuelven a la cola de reconocimiento.
3. **Borrar:** **Más opciones → Borrar el reporte**. La confirmación dice qué se pierde, con la cantidad de avisos de otras personas. Al confirmar volvés al mapa y el caso ya no está; en Storage desaparecieron tus fotos del caso con sus miniaturas (las de otras personas quedan).
4. **Compartir:** en el celular, el botón de compartir del detalle abre la hoja del sistema con un texto como "Se perdió Toby, perro marrón. Si lo viste, avisá acá: <link>". En una computadora sin hoja de compartir aparecen **Mandar por WhatsApp** y **Copiar el link**.
5. **Vista previa del link:** pegá el link de un caso en WhatsApp o Telegram, o en el [depurador de Facebook](https://developers.facebook.com/tools/debug/): aparecen el título ("Se perdió Toby", "Perro encontrado"), una descripción corta y la miniatura. Un caso oculto o inexistente muestra la vista previa genérica. Desde una terminal: `curl -s -A "facebookexternalhit/1.1" https://spot-uy.vercel.app/animal/<id> | grep 'og:'`. Abierto en el navegador, el link muestra la app de siempre.
6. **Ver lista:** en el celular, en la hoja **Cerca tuyo**, **Ver lista** abre todos los casos con los filtros del mapa, del más cercano al más lejano, con miniatura, etiqueta y distancia. Si cambiás un filtro ahí, el mapa también cambia.

Editar y borrar, probados directo en la base: `supabase/tests/fase8_casos.sql`.

**Fase 9 · revisión integral (parte 1)**

Con la migración 0013 aplicada:
1. **Escribir:** desde un caso solo se le escribe a quien lo publicó o a quien lo resguarda, como siempre ofreció la app; la base ya no deja abrir una conversación con cualquier otra persona. (Desde la parte 2, además, quien publicó le escribe a quien lo vio.)
2. **Resguardar:** "¿Dónde está ahora?" dice que se muestra aproximada; en el historial, el punto queda redondeado a unos 100 m.
3. **Bloqueos y coincidencias:** si la familia bloqueó a quien publicó un encontrado parecido, no recibe el aviso de esa coincidencia (la ve igual en el detalle).
4. **Errores:** sin conexión o con un link roto (`/animal/abc`), los mensajes salen en español.
5. **En el celular:** "Usar mi ubicación" toma la posición de ese momento; el mapa no gira ni se inclina con dos dedos; tirar hacia abajo no recarga la app en Chrome de Android.

Las reglas nuevas, probadas directo en la base: `supabase/tests/fase9_revision.sql`. La lógica de la app: `npm run test`.

**Fase 9 · revisión integral (parte 2)**

Con la migración 0014 aplicada:
1. **Escribirle a quien lo vio:** en el Historial de tu caso, cada aviso de otra persona tiene **Escribirle**, que abre o retoma una conversación con ella.
2. **Casos ocultos:** un caso ocultado desde el panel de moderación deja de verse por su link y por la API (sin cuenta o con otra cuenta: "Esta publicación no está disponible."). Quien lo publicó y moderación lo siguen viendo; las conversaciones que había siguen, con "Publicación no disponible". **Volver a mostrar** restaura todo.
3. **Atrás en web:** con una hoja abierta ("Lo vi", Más opciones, Denunciar, el selector de ubicación), Atrás la cierra y deja la pantalla como estaba.
4. **Campos:** el borde de los campos de texto y del recuadro de la foto se distingue del fondo (3:1).

Probado en la base: `supabase/tests/fase9_parte2.sql`. A mano: los pasos 9, 10 y 15 de `docs/PRUEBAS-MANUALES.md`.

**Mejoras · hoja plegable, instalar la app y reportar un error**

Con las migraciones 0015 y 0016 aplicadas:
1. **Hoja "Cerca tuyo" (celular):** se pliega arrastrando la manija o tocándola; plegada queda la barra con la cantidad de casos y el mapa usa todo el alto. Se acuerda al recargar.
2. **Instalar la app (web):** **Perfil → Instalar la app** abre la ventana de Chrome o Edge, muestra los pasos en iPhone, o explica cómo abrir el link en Chrome o Safari desde WhatsApp, Instagram o Facebook. Instalada, no aparece.
3. **Reportar un error:** **Perfil → Reportar un error**, con o sin cuenta. Moderación recibe un aviso y lo resuelve en **Moderación → Errores**; quien lo mandó con su cuenta recibe la respuesta en Actividad.

Probado en la base: `supabase/tests/errores.sql`. La lógica de la app: `npm run test`. A mano: los pasos 21 a 24 de `docs/PRUEBAS-MANUALES.md`.

**Reconocimiento con la API de Claude**

Con las migraciones 0017 a 0020 aplicadas y la función desplegada (paso 5):
1. **Moderación → Reconocimiento** dice si está configurado, apagado o pausado por falta de crédito; las fotos pendientes y con error; las llamadas a la IA de hoy, el costo estimado del mes y los últimos errores; y cuándo se procesó la última foto y apareció la última coincidencia.
2. **Procesar pendientes ahora** llama a la función, como el trabajo de pg_cron de cada 2 minutos. Si se pausó sin crédito, **Reactivar**.
3. En **Posibles coincidencias**, las de la IA muestran por qué se parecen en vez del porcentaje.

Probado en la base: `supabase/tests/reconocimiento_ia.sql` y `vision.sql`. La función: `deno test --allow-env` en `supabase/functions/reconocer` (con la API simulada). A mano: el paso 26 de `docs/PRUEBAS-MANUALES.md`.

**Ingresar con Google con el botón de Google** (sin migración)

Con `EXPO_PUBLIC_GOOGLE_CLIENT_ID` y el sitio en los orígenes autorizados de Google (paso 1.8):
1. **Ingresar y Registrarse** muestran, debajo de "o", el botón oficial "Continuar con Google". La ventana de Google muestra el sitio, no la dirección de Supabase. Al elegir la cuenta, la sesión queda abierta sin salir de la página; quien entra por primera vez acepta los términos como siempre.
2. **Respaldo:** si el script de Google no carga, sin la variable o en la app nativa, el botón de siempre, que pasa por Supabase.
3. **En el navegador de WhatsApp, Instagram o Facebook:** en lugar del botón, cómo abrir el link en Chrome o Safari, con "Copiar el link". Con email y contraseña se sigue igual.

Probado: `__tests__/google.test.ts` (el nonce, qué se muestra, el script que no carga y la llamada a `signInWithIdToken`) y `__tests__/indexHtml.test.ts` (la CSP). A mano: el paso 34 de `docs/PRUEBAS-MANUALES.md`.

**Privacidad de los casos reunidos** (migración 0027)
Cuando el animal volvió a casa, quien no participó en el caso (con o sin cuenta) ve solo la foto, el nombre si la familia lo mostró, la especie, "Volvió a casa" y el link a su historia. El mapa, la zona, los avisos, el historial, las coincidencias y los contactos los ven solo quienes participaron (publicaron, avisaron que lo vieron, lo resguardaron o le escribieron antes de que volviera) y moderación. Lo aplica la base, también a la vista previa del link; si el caso se reabre, vuelve a verse todo. Probado en la base: `supabase/tests/privacidad_reunidos.sql`. De punta a punta: `npm run e2e`. A mano: el paso 33 de `docs/PRUEBAS-MANUALES.md`.

**Muro de reencuentros** (migraciones 0025 y 0026)
1. **Contar cómo volvió:** al marcar su perdido como reunido, la familia ve "¡Qué alegría! ¿Querés contar cómo volvió?" (también después, desde "Cómo volvió" en el caso): una frase de hasta 280 caracteres, una foto opcional y si se muestra el nombre. Los teléfonos, links y emails se tapan. La edita o la borra cuando quiera.
2. **Agradecer:** en el mismo paso, quienes participaron (avisaron que lo vieron, lo resguardaron o le escribieron) con su nombre público; a quien marca le llega "La familia de Toby te agradeció" en Actividad y, con la función `avisar` desplegada de nuevo, al celular. En su Perfil: "Ayudaste a reunir a N familias".
3. **El muro:** `/reencuentros`, sin cuenta: "N animales volvieron a casa con Spot" (con menos de 5, "Los primeros reencuentros de Spot") y las historias más recientes, sin nombrar a nadie. Se llega desde una tarjeta al final de "Cerca tuyo" y desde Perfil. Cada historia se comparte con su link (con vista previa) y como historia de Instagram ("VOLVIÓ A CASA").
4. **Moderación:** las historias se denuncian aparte del caso y se ocultan desde el panel.

Probado en la base: `supabase/tests/reencuentros.sql`. La función: `deno test --allow-env` en `supabase/functions/avisar`. De punta a punta: `npm run e2e`. A mano: el paso 32 de `docs/PRUEBAS-MANUALES.md`. Pasos para producción: `docs/reportes/2026-10-22-reencuentros.md`.

**Notificaciones en el celular e historias de Instagram** (migración 0024)
1. **Después de publicar,** el caso pregunta "¿Querés que te avisemos al celular cuando alguien lo vea?"; en **Perfil → La app**, el interruptor "Notificaciones en este celular". Con la función configurada (paso 6), cuando alguien ve el caso llega "Alguien vio a Toby"; tocarla abre el caso.
2. **Compartir en historias,** al lado de Compartir en un caso abierto: una imagen de 1080 × 1920 con la foto, "SE PERDIÓ" o "ENCONTRADO", el nombre, la fecha y el logo, que se manda a Instagram (y copia el link para el sticker de enlace) o se descarga.

Probado en la base: `supabase/tests/avisos_push.sql`. La función: `deno test --allow-env` en `supabase/functions/avisar`. A mano: los pasos 30 y 31 de `docs/PRUEBAS-MANUALES.md`.

**Spot y preparación para el piloto** (migraciones 0021 y 0022)
1. **Nombre e ícono:** la pestaña, la pantalla de carga, ingresar y la app instalada dicen Spot, con el pin y la huella.
2. **Captcha:** con `EXPO_PUBLIC_TURNSTILE_SITE_KEY`, registrarse, ingresar con email y recuperar la contraseña muestran la comprobación de Cloudflare; Google no. Sin la variable, todo sigue como antes.
3. **Mensajes:** en una conversación abierta, cada 4 s se piden solo los mensajes nuevos.
4. **Contacto de la familia:** al marcar un perdido como reunido, su contacto desaparece del caso.
5. **Vista previa:** un color con números no aparece en la vista previa ni en el texto de compartir.

Probado en la base: `supabase/tests/contacto_al_cerrar.sql`. A mano: "Spot y el piloto" en `docs/PRUEBAS-MANUALES.md`.

**Fase 4 · notificaciones, mensajes, moderación**
1. Con la demo seguí un animal; con tu cuenta registrá un avistamiento sobre ese animal. En la demo, la pestaña **Actividad → Novedades** muestra "Lo vieron de nuevo".
2. Desde el detalle, **Escribirle a quien publicó** abre un chat. Respondé desde la otra cuenta: los mensajes llegan en pocos segundos y la otra persona recibe la novedad.
3. Marcá tu usuario como moderador (SQL del paso 1.8): en **Perfil** aparece **Panel de moderación** con las denuncias, para revisarlas, descartarlas y ocultar o mostrar publicaciones.

## App nativa (más adelante)

El mismo código compila para Android e iOS (MapLibre React Native, push con Expo Notifications). Necesita development build: `npx eas-cli build --profile development`. No corre en Expo Go.

## Estructura

```
src/app/            rutas (Expo Router): (tabs)/ mapa·publicar·actividad·perfil, animal/[id] (detalle, editar y mapa del recorrido), casos (lista), conversacion/[id], moderacion, auth/, cuenta/, legal/
src/components/     ui/ (botones, inputs, chips, casillas, avatar, modales), mapa/ (nativo .tsx y web .web.tsx), reportes/, auth/, legal/, errores/, instalar/, moderacion/, notificaciones/ (pregunta e interruptor del push web), historias/ (hoja de la historia), reencuentros/ (el muro, en un bloque aparte, y el contador)
src/features/       auth, reportes, seguimientos, denuncias, coincidencias, notificaciones (también Web Push: celular.web.ts y formaDeAvisar.ts), mensajes, moderacion, perfil, bloqueos, cuenta, legal, mapa, instalar, errores, historias (diseño y generador de la imagen), reencuentros (historias, agradecimientos y el muro)
src/lib/            supabase, imágenes (convención de miniaturas), fotos (comprimir, subir, borrar), compartir, ubicación, fechas, errores, env
src/i18n/es-UY.ts   todos los textos
src/types/          database.ts (esquema), dominio.ts
supabase/           migrations/ (0001–0027), tests/ (pruebas SQL por fase, errores.sql, vision.sql, reconocimiento_ia.sql, contacto_al_cerrar.sql, auditoria_2.sql, avisos_push.sql, reencuentros.sql y privacidad_reunidos.sql), functions/reconocer (Edge Function del reconocimiento con la API de Claude y sus pruebas), functions/avisar (Edge Function de las notificaciones del celular, Web Push, y sus pruebas), templates/ (plantillas de mail de Auth), seed.sql, config.toml
api/                función de Vercel: vista previa del link de un caso (Open Graph)
__tests__/          pruebas de jest-expo (npm run test)
e2e/                pruebas de punta a punta con Playwright (npm run e2e), contra el proyecto de pruebas
services/vision/    alternativa sin desplegar: microservicio Python de embeddings (Google Cloud Run), desplegar.sh, evaluar.py y tests/
scripts/            evaluar-ia.ts (evaluar el reconocimiento con fotos), tipos de la base, íconos de la web (iconos-web.py), plantillas de mail y lo que copia postinstall
assets/             marca/ (el logo en SVG, fuente oficial) e images/ (íconos de la app y pantalla de carga nativa)
public/             estáticos de la web: index.html, manifest y service worker (instalar y notificaciones del celular), íconos (scripts/iconos-web.py), robots.txt y lo que copia postinstall (worker y estilos de MapLibre, fuentes)
docs/               arquitectura, decisiones, diseño, pruebas manuales y reportes
vercel.json         despliegue (y qué pedidos van a la función de api/)
```

## Atribución de mapas

Teselas y estilo: [OpenFreeMap](https://openfreemap.org) · © [OpenMapTiles](https://openmaptiles.org) · Datos © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).

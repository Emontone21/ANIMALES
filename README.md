# Encontrados · animales encontrados en Montevideo

App para reunir perros y gatos perdidos con sus familias. La familia que perdió un animal lo publica en un mapa con una foto, y quien encuentra uno, también; otras personas avisan que lo vieron en otro lugar, que lo resguardaron o que ya volvió a su casa. La app compara las fotos y sugiere cuándo dos reportes podrían ser el mismo animal; una persona confirma, nunca se unen solos. Hay mensajería interna para hablar sin compartir datos personales, notificaciones y un panel de moderación. Cada persona maneja su cuenta (contraseña, perfil, borrado) y se protege de otros usuarios (bloqueos, términos, resguardo de perdidos con foto).

Interfaz en español rioplatense. Stack: Expo + React Native + TypeScript (corre en el navegador y, con el mismo código, como app nativa), Supabase en la nube (Auth, Postgres con PostGIS y pgvector, Storage), mapas MapLibre con teselas gratuitas de OpenFreeMap, reconocimiento de imágenes con modelos open source en un Space gratuito de Hugging Face. Se despliega en Vercel.

Estado: las fases 1 a 4 del brief, la Fase 6 (reportes de perdidos) y la Fase 7 (cuenta y protección de usuarios) están implementadas. Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [docs/DECISIONES.md](docs/DECISIONES.md).

Todo corre en la nube: no hace falta Docker ni Android Studio. Solo Node 20+ para desarrollar.

## Puesta en marcha

### 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratuito). Guardá la contraseña de la base.
2. En **Project Settings → API** copiá la **Project URL**, la clave **anon / publishable** y la **service_role** (esta última es secreta: solo va al servicio de visión).
3. Aplicá las migraciones de `supabase/migrations/` **en orden** (0001 a 0011). Dos formas:

   **a) CLI** (sin instalar nada):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```

   El `<ref>` está en la URL del dashboard (`supabase.com/dashboard/project/<ref>`).

   **b) Dashboard:** SQL Editor → pegá y ejecutá cada archivo, uno por uno, en orden. La 0009 va sola: agrega un valor a un enum que la 0010 usa, y Postgres no deja usarlo en la misma ejecución.

4. Datos de demo (opcional): ejecutá `supabase/seed.sql` en el SQL Editor. Crea `demo@encontrados.uy` / `demo1234`, tres animales encontrados y un perro perdido (Toby) cerca del de Parque Rodó. La demo acepta los términos la primera vez que publica, escribe o denuncia. Cambiá la contraseña de la demo antes de abrir la web al público.
5. **Authentication → URL Configuration:** Site URL = tu URL de Vercel (cuando la tengas). Redirect URLs: `http://localhost:8081/**`, `https://<tu-sitio>.vercel.app/**`, `encontrados://**`. Con el `/**` entran los links de recuperación de contraseña, que vuelven a `/auth/nueva-contrasena`.
6. **Authentication → Emails → Templates → Reset Password:** el texto en español está en `docs/reportes/2026-10-19-cuenta.md` (sección 4). Para abrir la web al público, configurá un SMTP propio: el servidor gratuito manda pocos mails por hora.
7. Google (opcional): cliente OAuth **Web application** en Google Cloud con redirect `https://<ref>.supabase.co/auth/v1/callback`; pegá client ID y secret en **Authentication → Providers → Google**.
8. Moderadores (opcional): `update perfiles set es_moderador = true where id = '<uuid>';`
9. Pruebas (opcional, recomendado después de cada migración): corré en el SQL Editor los archivos de `supabase/tests/` (ver su README). Terminan en `Success. No rows returned` y no dejan datos.

### 2. Variables de entorno

```bash
cp .env.example .env
```

Completá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. En Vercel van en **Settings → Environment Variables**.

### 3. Correr la web

```bash
npm install
npx expo start --web
```

Abre `http://localhost:8081`. En PowerShell, si `npx` está bloqueado por la política de scripts, usá `npx.cmd`.

### 4. Vercel

1. En [vercel.com](https://vercel.com) → **Add New Project** → importá `Emontone21/ANIMALES`. En **Framework Preset** elegí **Other**: Vercel suele detectar **FastAPI** por el servicio de visión en `services/vision/` y el build falla en `uv pip install`. `vercel.json` ya trae build (`npx expo export -p web`) y salida (`dist`). Si el proyecto ya existe, se cambia en **Settings → Build and Deployment → Framework Preset**.
2. Cargá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (y opcionalmente `EXPO_PUBLIC_MAP_STYLE_URL`).
3. Deploy. Cada push a `main` redeploya. Volvé a Supabase y poné la URL de Vercel como Site URL.

### 5. Servicio de visión (reconocimiento)

Sigue [services/vision/README.md](services/vision/README.md): un Space de Hugging Face tipo Docker con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `VISION_SECRET`, y luego en Supabase:

```sql
update config_app set valor = 'https://<usuario>-<space>.hf.space' where clave = 'vision_url';
update config_app set valor = '<VISION_SECRET>' where clave = 'vision_secret';
```

Sin este paso la app funciona igual; solo no aparecen "posibles coincidencias".

### 6. Push (solo app nativa)

Las notificaciones in-app funcionan en web sin configurar nada. Para push en Android/iOS hace falta un proyecto de EAS (`npx eas-cli init`, que agrega `extra.eas.projectId` a `app.json`) y un development build. La web muestra las mismas novedades en la pestaña Actividad.

## Scripts

| Comando | Qué hace |
|---|---|
| `npx expo start --web` | Servidor de desarrollo web |
| `npx expo export -p web` | Build estático en `dist/` (lo que corre Vercel) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier |
| `npm run format` | Formatea `src/` |
| `npm run db:push` | Sube migraciones al proyecto enlazado |
| `npm run db:types` | Regenera `src/types/database.ts` desde el proyecto enlazado |

## Cómo probar cada fase

Todo en el navegador. Conviene tener dos cuentas: la demo (`demo@encontrados.uy` / `demo1234`) y una tuya.

**Fase 1 · mapa y publicación**
1. Sin cuenta: mapa de Montevideo con los animales de demo. Chips por tipo y, en **Más filtros**, especie, estado y antigüedad. Clic en un marcador muestra su foto y pone su tarjeta primera en **Cerca tuyo**; la tarjeta abre el detalle.
2. En **Publicar** te pide cuenta. Creá una con email o entrá con la demo.
3. **Publicar → Encontré un animal**: foto, datos, "¿cuándo lo viste?" y ubicación (GPS o punto en el mapa). Caés en el detalle y el animal aparece en el mapa.

**Fase 2 · interacciones**
1. Con tu cuenta, abrí un animal de la demo y tocá **Lo vi**: foto, cuándo, dónde, nota. El historial suma una fila y el mini mapa dibuja el recorrido; en el mapa principal, al seleccionar el animal, se ve la línea entre avistamientos.
2. **Me lo llevé / está resguardado**: escribí un contacto opcional. El estado cambia, el contacto se ve en el detalle y queda en el historial. **Se volvió a escapar** lo reabre; en un encontrado, solo lo pueden decir quien lo publicó y quien lo resguarda.
3. **Se reunió con su familia** cierra el caso (deja de estar en "Activos"). En un encontrado lo pueden marcar quien lo publicó y quien lo tiene resguardado; reabrirlo, solo quien publicó.
4. **Seguir** y **Denunciar** (motivo + detalle). Tres denuncias de cuentas distintas con al menos 7 días ocultan la publicación.

**Fase 3 · reconocimiento**
1. Con el servicio de visión configurado, publicá dos reportes con fotos del mismo animal a pocas cuadras y con poca diferencia de tiempo.
2. En un minuto (más si el Space estaba dormido) el detalle muestra **Posibles coincidencias** con el porcentaje de parecido, distancia y tiempo. Se refresca solo cada 30 s.
3. Entre dos encontrados deciden quien publicó cualquiera de los dos o un moderador. **Es el mismo animal** une los reportes: el más viejo queda como principal y el otro redirige a él. **No es el mismo** lo descarta y queda registrado para calibrar el umbral (`config_app.umbral_similitud`).

**Fase 6 · reportes de perdidos**

Necesitás tres cuentas: la familia, alguien que encuentra y un tercero.
1. Sin cuenta: en el mapa, los chips **Todos · Perdidos · Encontrados** filtran por tipo; la especie quedó en **Más filtros**. Toby (seed) tiene el anillo naranja y un halo que lo distingue también en escala de grises.
2. Con la familia: **Publicar → Perdí a mi animal**. Cargá foto, especie, nombre, tamaño, color, collar, señas, "¿Cuándo se perdió?" (en días) y dónde lo vieron por última vez; el formulario avisa que no hace falta la casa exacta. Opcional: un contacto para mostrar. En el detalle: el nombre primero, **Perdido desde el …**, la etiqueta naranja **Perdido** y, si cargaste contacto, **Lo buscan** junto al aviso contra estafas. El punto guardado está redondeado a unos 100 m.
3. Con el tercero, en ese perdido: **Lo vi** y **Me lo llevé / está resguardado** funcionan (resguardarlo pide una foto actual); **Se reunió con su familia** y **Se volvió a escapar** no aparecen. Con la familia, sí.
4. Con quien encuentra: **Publicar → Encontré un animal** con una foto parecida, cerca y después de la pérdida. Con el servicio de visión andando aparece la coincidencia: la familia recibe "Encontraron un animal parecido a <nombre>" y es la única que ve **Es el mismo animal** y **No es el mismo**; el resto ve "Su familia está mirando las fotos…". Al confirmar, el perdido queda como principal; si el encontrado estaba resguardado, el perdido pasa a resguardado con ese contacto.
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
7. **Borrar la cuenta:** con B, **Perfil → Borrar mi cuenta**. Elegí si sus casos abiertos y lo que aportó a casos de otros quedan publicados sin su nombre (por defecto) o se borran, marcá que entendés y confirmá. Volvés al mapa sin sesión. Los casos que quedaron dicen "una cuenta eliminada" en el historial, sin botón para escribir.

Todas las reglas, probadas directo en la base: `supabase/tests/fase7_cuenta.sql`.

**Fase 4 · notificaciones, mensajes, moderación**
1. Con la demo seguí un animal; con tu cuenta registrá un avistamiento sobre ese animal. En la demo, la pestaña **Actividad → Novedades** muestra "Lo vieron de nuevo".
2. Desde el detalle, **Escribirle a quien publicó** abre un chat. Respondé desde la otra cuenta: los mensajes llegan en pocos segundos y la otra persona recibe la novedad.
3. Marcá tu usuario como moderador (SQL del paso 1.8): en **Perfil** aparece **Panel de moderación** con las denuncias, para revisarlas, descartarlas y ocultar o mostrar publicaciones.

## App nativa (más adelante)

El mismo código compila para Android e iOS (MapLibre React Native, push con Expo Notifications). Necesita development build: `npx eas-cli build --profile development`. No corre en Expo Go.

## Estructura

```
src/app/            rutas (Expo Router): (tabs)/ mapa·publicar·actividad·perfil, animal/[id], conversacion/[id], moderacion, auth/, cuenta/, legal/
src/components/     ui/ (botones, inputs, chips, casillas, avatar, modales), mapa/ (nativo .tsx y web .web.tsx), reportes/, auth/, legal/
src/features/       auth, reportes, seguimientos, denuncias, coincidencias, notificaciones, mensajes, moderacion, perfil, bloqueos, cuenta, legal
src/lib/            supabase, imágenes, ubicación, fechas, env
src/i18n/es-UY.ts   todos los textos
src/types/          database.ts (esquema), dominio.ts
supabase/           migrations/ (0001–0011), tests/ (pruebas SQL por fase), seed.sql, config.toml
services/vision/    microservicio Python de reconocimiento (Hugging Face Spaces)
public/             estáticos de la web (worker de MapLibre, generado en postinstall)
docs/               arquitectura y decisiones
vercel.json         despliegue
```

## Atribución de mapas

Teselas y estilo: [OpenFreeMap](https://openfreemap.org) · © [OpenMapTiles](https://openmaptiles.org) · Datos © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).

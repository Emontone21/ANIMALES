# Encontrados · animales encontrados en Montevideo

App para reunir perros y gatos perdidos con sus familias. Quien encuentra un animal lo publica en un mapa con una foto; otras personas pueden avisar que lo vieron en otro lugar, que lo resguardaron o que ya volvió a su casa. La app compara fotos para sugerir cuándo dos reportes podrían ser el mismo animal (nunca los une sola: una persona confirma).

Interfaz en español rioplatense. Stack: Expo + React Native + TypeScript (corre en el navegador y, más adelante, como app nativa), Supabase en la nube (Auth, Postgres con PostGIS y pgvector, Storage, Edge Functions), mapas MapLibre con teselas gratuitas de OpenFreeMap. Se despliega en Vercel.

Estado: **Fase 1** (proyecto base, auth, mapa, publicación con foto). Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [docs/DECISIONES.md](docs/DECISIONES.md).

Todo corre en la nube: no hace falta Docker ni Android Studio. Solo Node 20+ para el build.

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto (plan gratuito alcanza). Elegí una contraseña de base de datos y guardala.
2. En **Project Settings → API** copiá la **Project URL** y la clave **anon / publishable**.
3. Aplicá las migraciones. Dos opciones:

   **a) Con la CLI** (no instala nada, usa `npx`):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

   El `<ref>` es el código que aparece en la URL del dashboard (`supabase.com/dashboard/project/<ref>`). `db push` pide la contraseña de la base.

   **b) En el dashboard**: abrí **SQL Editor** y pegá, en orden, el contenido de `supabase/migrations/20261017000001_base.sql`, `…0002_storage.sql` y `…0003_rls_y_funciones.sql`. Ejecutá cada uno.

4. Datos de demo (opcional): pegá `supabase/seed.sql` en el SQL Editor. Crea la usuaria `demo@encontrados.uy` / `demo1234` y tres animales en Montevideo.
5. En **Authentication → URL Configuration** poné como **Site URL** la URL de tu sitio en Vercel (cuando la tengas) y agregá a **Redirect URLs**: `http://localhost:8081/**`, `https://<tu-sitio>.vercel.app/**` y `encontrados://**`.
6. Google (opcional): en Google Cloud Console creá un cliente OAuth **Web application** con redirect URI `https://<ref>.supabase.co/auth/v1/callback`. En Supabase, **Authentication → Providers → Google**, pegá client ID y secret.

## 2. Variables de entorno

```bash
cp .env.example .env
```

Completá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` con los valores del paso 1. En Vercel, las mismas variables van en **Settings → Environment Variables**.

## 3. Correr la web

```bash
npm install
npx expo start --web
```

Abre `http://localhost:8081`. `npm install` también copia el worker de MapLibre a `public/` (script `postinstall`).

## 4. Desplegar en Vercel

1. Subí el repo a GitHub (ya está en `Emontone21/ANIMALES`).
2. En [vercel.com](https://vercel.com) → **Add New Project** → importá el repo. Vercel lee `vercel.json` (build `npx expo export -p web`, salida `dist`). No elijas framework.
3. Agregá las variables `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y, opcionalmente, `EXPO_PUBLIC_MAP_STYLE_URL`.
4. Deploy. Cada push a `main` vuelve a desplegar.
5. Volvé a Supabase y poné la URL de Vercel como Site URL (paso 1.5).

Para probar el build de producción en tu máquina: `npx expo export -p web` y serví la carpeta `dist` con cualquier servidor estático.

## Scripts

| Comando | Qué hace |
|---|---|
| `npx expo start --web` | Servidor de desarrollo web |
| `npx expo export -p web` | Build estático en `dist/` (lo que corre Vercel) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier |
| `npm run format` | Formatea `src/` |
| `npm run db:push` | Sube migraciones al proyecto de Supabase (requiere `supabase link`) |
| `npm run db:types` | Regenera `src/types/database.ts` desde el proyecto enlazado |

## Cómo probar la Fase 1 (en el navegador)

1. Abrí el sitio sin cuenta: tenés que ver el mapa de Montevideo. Si cargaste el seed, aparecen tres animales; probá los filtros (especie, estado, antigüedad) y hacé clic en un marcador para ver la tarjeta y el detalle con su historial.
2. En **Publicar** te pide cuenta. Creá una con email (Supabase manda un correo de confirmación; el link vuelve al sitio con la sesión abierta) o ingresá con la usuaria demo.
3. Publicá un animal: elegí una foto, completá los datos, usá "Usar mi ubicación" (el navegador pide permiso) o "Elegir en el mapa", y tocá Publicar. Tenés que caer en el detalle del animal nuevo.
4. Volvé al mapa: el animal nuevo aparece en el punto que marcaste. En el dashboard de Supabase lo ves en **Table Editor → animales / avistamientos**, y la foto en **Storage → fotos/<tu uid>/**.
5. Abrí el sitio en otro navegador o celular: tiene que verse el mismo reporte.

## App nativa (más adelante)

El mismo código compila para Android e iOS con MapLibre React Native. Necesita un development build (`npx eas-cli build --profile development`), no corre en Expo Go. Queda para cuando la web esté validada.

## Estructura

```
src/app/            rutas (Expo Router): (tabs)/, animal/[id], auth/
src/components/     ui/ (botones, inputs, chips), mapa/ (nativo .tsx y web .web.tsx), reportes/, auth/
src/features/       auth, reportes, perfil: acceso a datos y hooks
src/lib/            supabase, imágenes, ubicación, fechas, env
src/i18n/es-UY.ts   todos los textos
src/types/          database.ts (esquema), dominio.ts
supabase/           migrations/, seed.sql, config.toml
public/             archivos estáticos de la web (worker de MapLibre, generado)
docs/               arquitectura y decisiones
vercel.json         configuración de despliegue
```

## Atribución de mapas

Teselas y estilo: [OpenFreeMap](https://openfreemap.org) · © [OpenMapTiles](https://openmaptiles.org) · Datos © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).

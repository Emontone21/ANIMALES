# AGENTS.md · Encontrados

Instrucciones para agentes de código que trabajen en este repo. Leé también `README.md`, `docs/ARQUITECTURA.md`, `docs/DECISIONES.md` y `docs/DISENO.md`.

## Qué es

App Expo + React Native + TypeScript con backend Supabase en la nube para reunir animales perdidos con sus familias en Montevideo. Hoy se publica como **web en Vercel**; la versión nativa (Android/iOS) usa el mismo código y queda para después. Interfaz en español rioplatense con voseo. Detalle en `README.md`.

## Reglas del proyecto

- **Diseño:** las decisiones visuales están en `docs/DISENO.md`. Todo componente nuevo o modificado las respeta. Ningún color se escribe fuera de `src/constants/tema.ts`: los componentes toman la paleta activa con `useTema()` o `useEstilos()` (`src/hooks/useTema.ts`), así funcionan en modo claro y oscuro.
- **Textos:** todo texto visible sale de `src/i18n/es-UY.ts`. Nada de strings inline en componentes. Voseo ("tocá", "elegí"), nunca "tú".
- **Privacidad:** ninguna tabla pública guarda email ni teléfono. El contacto entre usuarios es por mensajería interna o por el dato que la persona decide compartir explícitamente.
- **RLS en todas las tablas.** Toda tabla nueva lleva `enable row level security` y políticas en la misma migración.
- **Migraciones versionadas** en `supabase/migrations/AAAAMMDDhhmmss_nombre.sql`. Nunca editar una migración ya aplicada: agregar otra.
- **Tipos de la base:** `src/types/database.ts` se regenera con `npm run db:types` desde el proyecto enlazado (`npx supabase link`), con las migraciones ya aplicadas. Si cambiás el esquema y todavía no está aplicado, actualizalo a mano con el mismo formato.
- **Reconocimiento:** nunca fusionar reportes automáticamente. Mostrar coincidencias y que una persona confirme: si el par incluye un perdido, solo su familia; entre dos encontrados, quien publicó cualquiera de los dos o un moderador.
- **Perdidos y encontrados** conviven en `animales` (`tipo_reporte`). Un perdido solo lo cierra o reabre su familia, y nunca se sugiere con otro perdido. Las RPC de publicación y avistamiento solo aceptan fotos subidas a la carpeta del usuario en el bucket `fotos`.
- **Licencias:** solo modelos y librerías con licencias permisivas (Apache 2.0, MIT, BSD). Nada de AGPL (por ejemplo YOLOv8). Excepción aprobada por el dueño: fuentes tipográficas bajo SIL OFL 1.1 (hoy Fredoka y Figtree, ver `docs/DECISIONES.md`).
- **Dependencias:** instalar con `npx expo install <paquete>` para respetar la versión del SDK. Módulos nativos nuevos exigen rebuild (`npx expo run:android`).
- **Nada local:** el backend es Supabase en la nube y la app se prueba en el navegador (`npx expo start --web`) o en Vercel. No propongas Docker ni builds nativos salvo que lo pidan.
- **Web y nativo:** todo componente que use mapas tiene versión `.web.tsx` (maplibre-gl) y `.tsx` (MapLibre React Native) con el mismo contrato en `src/components/mapa/tipos.ts`. Lo que toque cámara, archivos o auth debe funcionar en web (`Platform.OS === 'web'`).
- **Antes de dar algo por terminado:** `npm run typecheck`, `npm run lint` y `npx expo export -p web` sin errores.

## Expo cambia seguido

Las APIs de Expo cambian entre SDKs. Antes de escribir código que use un módulo de Expo, leé la versión del paquete `expo` en `package.json` y consultá `https://docs.expo.dev/versions/v<major>.0.0/` o el índice `https://docs.expo.dev/llms.txt`. No respondas de memoria. MapLibre React Native v11 también cambió su API (componentes `Map`, `Camera`, `GeoJSONSource`, `Layer` con `paint`/`layout`); los tipos en `node_modules/@maplibre/maplibre-react-native/src` son la referencia.

## Comandos

```bash
npx expo start --web        # servidor de desarrollo web (http://localhost:8081)
npx expo export -p web      # build estático para Vercel (dist/)
npm run typecheck           # tsc --noEmit
npm run lint                # eslint + prettier
npx supabase db push        # subir migraciones al proyecto en la nube (tras supabase link)
```

## Estructura

- `src/app/`: rutas de Expo Router. Solo pantallas y layouts; la lógica va afuera.
- `src/components/ui/`: componentes genéricos reutilizables. `mapa/`, `reportes/`, `auth/`: componentes por área.
- `src/features/<área>/`: acceso a datos (`api.ts`), hooks y acciones. Único lugar que llama a Supabase.
- `src/lib/`: utilidades sin React (supabase, imágenes, ubicación, fechas, env).
- `src/constants/tema.ts`: paletas claro y oscuro, espacios, radios, fuentes y escala tipográfica. `src/hooks/`: `useTema`, `useEstilos` y `useDisposicion` (compacto, medio, amplio).
- `supabase/`: configuración, migraciones (0001–0010), seed. `services/vision/`: microservicio Python de reconocimiento.
- `public/`: archivos estáticos de la web. `vercel.json`: despliegue.

## Fases

1. Proyecto base, auth, mapa, publicación con foto. **(hecha)**
2. Interacciones: "lo vi acá también", estados, historial, recorrido, denuncias. **(hecha)**
3. Reconocimiento: cola, servicio de visión, pgvector, coincidencias con confirmar/rechazar. **(hecha)**
4. Notificaciones, mensajería, moderación. **(hecha)**
6. Reportes de perdidos: la familia publica a su animal (`animales.tipo_reporte`, `nombre`, `contacto_familia`), chips Todos · Perdidos · Encontrados, reglas de quién cierra un caso y quién confirma coincidencias, perdido siempre como principal. **(hecha)**

Pendiente de configuración externa (lo hace el dueño del proyecto): proyecto Supabase con migraciones aplicadas, proyecto Vercel con variables, Space de Hugging Face para el servicio de visión. Ver README.

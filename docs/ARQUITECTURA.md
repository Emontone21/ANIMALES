# Arquitectura

## Piezas

```
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│  App Expo (RN + TS)  │ ─────▶ │  Supabase (nube)                        │
│  web en Vercel;      │ REST   │  Auth · Postgres (PostGIS, pgvector,    │
│  nativa más adelante │ RLS    │  pg_net) · Storage (bucket "fotos")     │
│  MapLibre + OSM      │        │                                         │
│  TanStack Query      │        │                                         │
└──────────────────────┘        └──────┬───────────────────┬──────────────┘
                                       │ webhook (pg_net)  │ push (pg_net)
                        ┌──────────────▼──────────┐   ┌────▼─────────────┐
                        │ services/vision         │   │ Expo Push API    │
                        │ FastAPI en HF Spaces    │   │ (exp.host)       │
                        │ YOLOS tiny + DINOv2     │   └──────────────────┘
                        └─────────────────────────┘
```

- La app habla directo con Supabase. Lee con RLS. Escribe directo solo en lo personal (perfil propio, seguimientos, denuncias, mensajes, notificaciones, tokens), con UPDATE limitado por columna; `animales`, `avistamientos` y `cambios_estado` solo se escriben por funciones SQL `security definer` que validan las reglas.
- No hay servidor propio: lo que no puede confiar en el cliente vive en Postgres (RPC y triggers). Las llamadas salientes (servicio de visión, Expo Push) se hacen con `pg_net` desde triggers.
- El reconocimiento de imágenes corre en un microservicio Python gratuito (Hugging Face Spaces). Escribe el embedding y la base busca coincidencias.

## Flujos

**Publicar.** La app comprime la foto (JPEG, 1280 px), la sube a `fotos/<uid>/<uuid>.jpg` y llama a `publicar_animal`, que inserta el animal y su primer avistamiento (`encontrado`) en una transacción. Quien publica sigue su caso automáticamente.

**Interactuar.** "Lo vi acá también" llama a `registrar_avistamiento` (foto obligatoria). Resguardar, reunido y reabrir pasan por `cambiar_estado_animal`, que valida las transiciones permitidas, guarda el historial en `cambios_estado` y, al resguardar, crea un avistamiento sin foto. Denunciar inserta en `denuncias`; a las 3 denuncias de personas distintas la publicación se oculta sola.

**Reconocer.** Cada avistamiento con foto entra en `cola_vision`; un trigger avisa al servicio de visión con `pg_net` (si `config_app.vision_url` está seteada). El servicio recorta al animal, calcula el embedding DINOv2 (384 d) y llama a `guardar_embedding`, que compara por similitud coseno contra el mejor avistamiento de cada otro animal de la misma especie, abierto, dentro de `radio_coincidencia_m` y `ventana_coincidencia_dias`, y crea `coincidencias` pendientes por encima de `umbral_similitud`. Una persona confirma (`resolver_coincidencia` vincula: los avistamientos del reporte más nuevo pasan al más viejo, que queda como principal) o rechaza. Nada se fusiona solo.

**Avisar.** La función `notificar` inserta en `notificaciones` y manda push a cada `push_tokens` del usuario vía Expo Push API. Triggers la llaman cuando aparece una coincidencia, cuando alguien ve o resguarda un animal seguido, cuando un caso se cierra o reabre, y cuando llega un mensaje. En web no hay push: la pestaña Actividad se refresca sola.

**Hablar.** `abrir_conversacion` crea (o reutiliza) una conversación entre dos usuarios sobre un animal. Los mensajes se leen por polling cada 4 s. Nadie ve emails ni teléfonos.

## Modelo de datos

| Tabla | Rol | Notas |
|---|---|---|
| `perfiles` | datos públicos del usuario | 1 a 1 con `auth.users`, creado por trigger. `es_moderador` se asigna por SQL. Sin email ni teléfono. |
| `animales` | el caso | `estado`: avistado / resguardado / reunido / vinculado. `vinculado_a` apunta al principal. `oculto` lo saca del mapa. |
| `avistamientos` | cada vez que alguien lo vio | `ubicacion geography(Point)`, `visto_en`, `foto_path`, `embedding vector(384)`, `bbox_recorte`, `procesado_en`. El primero es `encontrado`. |
| `cambios_estado` | historial | `contacto_compartido` es lo único que un usuario elige publicar de sí mismo. |
| `seguimientos` | seguir un caso | Define quién recibe novedades. |
| `denuncias` | moderación | Una por usuario y animal. Moderadores las resuelven. |
| `cola_vision` | trabajo pendiente del servicio | Reintentos hasta 5. |
| `config_app` | configuración privada | `vision_url`, `vision_secret`, `umbral_similitud`, `radio_coincidencia_m`, `ventana_coincidencia_dias`. Sin acceso desde la API. |
| `coincidencias` | candidatos | Par ordenado único. `similitud`, `distancia_m`, `horas_diferencia`, `estado` pendiente / confirmada / rechazada. Las resueltas calibran el umbral. |
| `push_tokens` | Expo Push | Solo app nativa. |
| `notificaciones` | Actividad in-app | `datos` jsonb con `animal_id`, `coincidencia_id` o `conversacion_id`. |
| `conversaciones`, `mensajes` | mensajería interna | Participantes ordenados; RLS solo para ellos. |

Vistas (con `security_invoker`): `animales_mapa`, `animales_detalle`, `avistamientos_detalle`, `cambios_estado_detalle`, `coincidencias_detalle`, `conversaciones_detalle`, `mensajes_detalle`, `denuncias_detalle`, `cola_vision_pendientes` (solo servicio).

RPC: `publicar_animal`, `registrar_avistamiento`, `cambiar_estado_animal`, `resolver_coincidencia`, `abrir_conversacion` (usuarios); `moderar_animal` (moderadores); `guardar_embedding`, `marcar_error_vision` (servicio, `service_role`); `notificar`, `interesados_en`, `es_moderador` (internas).

## Seguridad

- RLS en todas las tablas. Lectura pública de animales, avistamientos, historial y coincidencias; todo lo personal (seguimientos, denuncias, notificaciones, conversaciones, mensajes, tokens) solo para su dueño o participantes.
- Permisos de tabla además de RLS: `anon` y `authenticated` no tienen INSERT, UPDATE ni DELETE sobre `animales`, `avistamientos` ni `cambios_estado`. En `perfiles`, `mensajes`, `notificaciones` y `denuncias` el UPDATE se concede solo sobre las columnas que la app cambia; `es_moderador` se asigna únicamente por SQL. En `mensajes` y `denuncias` también el INSERT está limitado a las columnas que manda la app (`leido_en`, `estado` y `created_at` toman su default).
- Storage: bucket público de lectura; cada usuario escribe solo en `fotos/<uid>/`.
- Nada de datos personales en tablas públicas. Contacto por mensajería interna o por lo que la persona decide compartir en `cambios_estado.contacto_compartido`.
- Claves: la `anon` va en la app (pública por diseño); la `service_role` solo en el servicio de visión; `vision_secret` en `config_app` y en el servicio; Google en el dashboard de Supabase.

## Mapa

Estilo `positron` de OpenFreeMap (gratis, sin clave, datos de OpenStreetMap bajo ODbL), descargado una vez por sesión y recoloreado en el cliente con los tokens de mapa del esquema claro u oscuro (`estiloBase.ts` y `recolorearEstilo.ts`). Marcadores como capas de círculos sobre una fuente GeoJSON con clustering: fondo `superficie`, anillo del color del estado y halo para los perdidos; el seleccionado se dibuja aparte con su foto. Recorrido como línea punteada con el último punto en el color del caso. Las capas salen de `estilosCapa.ts`, que recibe la paleta. Colores y medidas en `docs/DISENO.md`. Dos implementaciones con el mismo contrato (`src/components/mapa/tipos.ts`):

- **Web:** `maplibre-gl` (BSD-3) en los `.web.tsx`. El worker se sirve desde `public/`.
- **Nativo:** MapLibre React Native (MIT) en los `.tsx`. Exige development build (no corre en Expo Go).

## Despliegue

Web estática en Vercel: `npx expo export -p web` genera `dist/` (modo `single`; `vercel.json` reenvía todas las rutas a `/`). Variables `EXPO_PUBLIC_*` en Vercel. Supabase en su plan gratuito; migraciones con `supabase db push` o pegadas en el SQL Editor. Servicio de visión en Hugging Face Spaces (ver `services/vision/README.md`).

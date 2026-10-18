# Arquitectura

## Piezas

```
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│  App Expo (RN + TS)  │ ─────▶ │  Supabase (nube)                        │
│  web en Vercel;      │ REST   │  Auth · Postgres (PostGIS, pgvector)    │
│  nativa más adelante │ RLS    │  Storage (bucket "fotos")               │
│  MapLibre + OSM      │        │  Edge Functions (fase 3-4)              │
│  TanStack Query      │        │                                         │
└──────────────────────┘        │                                         │
                                └──────────────┬──────────────────────────┘
                                               │ webhook + secreto (fase 3)
                                ┌──────────────▼──────────────────────────┐
                                │  services/vision (Python, HF Spaces)    │
                                │  detector Apache-2.0 + DINOv2 small     │
                                └─────────────────────────────────────────┘
```

- La app habla directo con Supabase. Toda escritura pasa por RLS o por funciones SQL que corren como el usuario.
- La lógica que no puede confiar en el cliente (cambios de estado de terceros, confirmación de coincidencias, notificaciones) vive en Postgres o en Edge Functions.
- El reconocimiento de imágenes corre en un microservicio Python gratuito (Hugging Face Spaces) que Supabase llama con un webhook. Escribe el embedding en `avistamientos.embedding` y las coincidencias candidatas en `coincidencias`.

## Flujo de una publicación

1. La app comprime la foto (JPEG, 1280 px de ancho) y la sube a `fotos/<uid>/<uuid>.jpg`.
2. Llama a la RPC `publicar_animal`, que inserta el animal y su primer avistamiento (tipo `encontrado`) en una transacción.
3. (Fase 3) Un trigger encola el avistamiento; el servicio de visión lo procesa, guarda el embedding y busca similares por coseno, filtrando por especie, distancia y tiempo. Las coincidencias quedan `pendientes`.
4. (Fase 4) Se notifica a quien publicó y a quien sigue el animal candidato. Una persona confirma o rechaza. Nada se fusiona solo.

## Modelo de datos

| Tabla | Rol | Notas |
|---|---|---|
| `perfiles` | datos públicos del usuario | 1 a 1 con `auth.users`, creado por trigger. Sin email ni teléfono. |
| `animales` | el caso | `estado`: avistado / resguardado / reunido / vinculado. `vinculado_a` apunta al animal "principal" cuando se confirmó que era el mismo. |
| `avistamientos` | cada vez que alguien lo vio | `ubicacion geography(Point)`, `visto_en`, `foto_path`, `embedding vector(384)` (fase 3). El primero es tipo `encontrado`. |
| `cambios_estado` | historial | `contacto_compartido` es lo único que un usuario elige publicar de sí mismo. |
| `coincidencias` (fase 3) | candidatos | `similitud`, `distancia_m`, `horas_diferencia`, `estado` pendiente / confirmada / rechazada. Las rechazadas calibran el umbral. |
| `seguimientos`, `denuncias` (fase 2) | seguir un caso, moderación | |
| `conversaciones`, `mensajes`, `push_tokens`, `notificaciones` (fase 4) | mensajería y push | |

Vistas para la app (con `security_invoker`): `animales_mapa` (un renglón por animal con lat/lng de su último avistamiento) y `avistamientos_detalle` (historial con lat/lng y nombre público).

## Seguridad

- RLS en todas las tablas. Lectura pública; escritura solo con cuenta y solo de lo propio.
- Storage: bucket público de lectura; cada usuario escribe solo en su carpeta `fotos/<uid>/`.
- Nada de datos personales en tablas públicas. El contacto entre usuarios se resuelve en la app (fase 4) o con el dato que la persona decide compartir en `cambios_estado.contacto_compartido`.
- Las claves de Google y de servicios externos van por variables de entorno; `.env` no se versiona.

## Mapa

Estilo `liberty` de OpenFreeMap (gratis, sin clave, datos de OpenStreetMap bajo ODbL). Los marcadores son una capa de círculos sobre una fuente GeoJSON con clustering; color por especie, borde verde para resguardados. Dos implementaciones con el mismo contrato (`src/components/mapa/tipos.ts`):

- **Web:** `maplibre-gl` (BSD-3) en `MapaReportes.web.tsx` y `MapaSelector.web.tsx`. El worker se sirve desde `public/`.
- **Nativo:** MapLibre React Native (MIT) en `MapaReportes.tsx` y `MapaSelector.tsx`. Exige development build (no corre en Expo Go).

Metro elige el archivo `.web.tsx` al compilar para web y el `.tsx` para Android/iOS.

## Despliegue

Web estática en Vercel: `npx expo export -p web` genera `dist/` (modo `single`, una sola página; `vercel.json` reenvía todas las rutas a `/`). Variables `EXPO_PUBLIC_*` configuradas en Vercel. Supabase en su plan gratuito; migraciones con `supabase db push`.

## Reconocimiento (fase 3)

- Embedding: DINOv2 small (Meta, Apache 2.0, 384 dimensiones). Mejor que CLIP para distinguir individuos parecidos.
- Detección y recorte: YOLOS tiny o RT-DETR (Apache 2.0), clases perro y gato de COCO. YOLOv8 queda descartado por ser AGPL-3.0.
- Búsqueda: pgvector con índice HNSW por coseno, filtrando por especie y por distancia/tiempo en SQL.
- Dónde corre: microservicio Python (FastAPI) en Hugging Face Spaces, llamado por un Database Webhook con un secreto compartido. Se duerme a las 48 h sin uso; una cola en Postgres con reintentos absorbe el arranque en frío.

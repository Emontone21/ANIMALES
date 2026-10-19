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

- La app habla directo con Supabase. Lee con RLS. Escribe directo solo en lo personal (perfil propio, seguimientos, denuncias, mensajes, notificaciones, tokens, bloqueos), con UPDATE limitado por columna; `animales`, `avistamientos`, `cambios_estado` y `contactos_resguardo` solo se escriben por funciones SQL `security definer` que validan las reglas.
- No hay servidor propio: lo que no puede confiar en el cliente vive en Postgres (RPC y triggers). Las llamadas salientes (servicio de visión, Expo Push) se hacen con `pg_net` desde triggers.
- El reconocimiento de imágenes corre en un microservicio Python gratuito (Hugging Face Spaces). Escribe el embedding y la base busca coincidencias.

## Flujos

**Publicar.** Primero se elige qué pasó: "Perdí a mi animal" (lo publica su familia) o "Encontré un animal". La app comprime la foto (JPEG, 1280 px), la sube a `fotos/<uid>/<uuid>.jpg` y llama a `publicar_animal` con `p_tipo`, que inserta el animal y su primer avistamiento en una transacción: `encontrado` o `perdido` ("visto por última vez"). La RPC solo acepta una foto que exista en la carpeta del usuario dentro del bucket `fotos`. En un perdido guarda el nombre y el contacto que la familia decide mostrar, y redondea la ubicación a 3 decimales (unos 100 m), porque ese punto suele ser su casa. Quien publica sigue su caso automáticamente.

**Interactuar.** "Lo vi" llama a `registrar_avistamiento` (foto obligatoria, también de la carpeta propia). Resguardar, reunido y reabrir pasan por `cambiar_estado_animal`, que valida las transiciones permitidas y quién puede hacerlas, guarda el historial en `cambios_estado` y, al resguardar, crea un avistamiento; el contacto que comparte quien lo resguarda va a `contactos_resguardo`. Cualquiera con cuenta puede resguardar; en un perdido, con una foto actual de la carpeta propia, que entra a la cola de reconocimiento. Un perdido solo lo marca como reunido o lo reabre su familia (quien lo publicó). Un encontrado lo marca como reunido, o lo vuelve a avistado ("se volvió a escapar"), quien lo publicó o quien lo tiene resguardado; reabrir un caso cerrado, solo quien lo publicó. Denunciar inserta en `denuncias`; a las 3 denuncias de cuentas distintas que tenían al menos 7 días al denunciar, la publicación se oculta sola.

**Reconocer.** Cada avistamiento con foto entra en `cola_vision`; un trigger avisa al servicio de visión con `pg_net` (si `config_app.vision_url` está seteada). El servicio recorta al animal, calcula el embedding DINOv2 (384 d) y llama a `guardar_embedding`, que compara por similitud coseno contra el mejor avistamiento de cada otro animal de la misma especie, abierto, dentro de `radio_coincidencia_m` y `ventana_coincidencia_dias`, y crea `coincidencias` pendientes por encima de `umbral_similitud`. Nunca sugiere un perdido con otro perdido, ni un encontrado cuyos avistamientos son todos de más de un día antes de la pérdida. Una persona confirma o rechaza con `resolver_coincidencia`: si el par incluye un perdido, solo su familia; entre dos encontrados, quien publicó cualquiera de los dos o un moderador. Confirmar vincula: los avistamientos del secundario pasan al principal, que es siempre el perdido o, entre dos encontrados, el más viejo. Si el secundario estaba resguardado y el principal no, el principal pasa a resguardado con el mismo contacto. Nada se fusiona solo.

**Avisar.** La función `notificar` inserta en `notificaciones` y manda push a cada `push_tokens` del usuario vía Expo Push API. Triggers la llaman cuando aparece una coincidencia (si incluye un perdido, su familia recibe un aviso propio con el nombre: "Encontraron un animal parecido a Toby"), cuando alguien ve o resguarda un animal seguido, cuando un caso se cierra o reabre, y cuando llega un mensaje. Cada aviso guarda quién lo causó (`actor_id`): no se manda a quien bloqueó a esa persona, y se borra si esa persona borra su cuenta. En web no hay push: la pestaña Actividad se refresca sola.

**Hablar.** `abrir_conversacion` crea (o reutiliza) una conversación entre dos usuarios sobre un animal. Los mensajes se leen por polling cada 4 s. Nadie ve emails ni teléfonos. Si hay un bloqueo entre los dos, en cualquier sentido, no se abren conversaciones ni se mandan mensajes (lo validan `abrir_conversacion` y la política de INSERT de `mensajes`); quien bloquea desbloquea desde la conversación o desde Perfil.

**Cuenta.**
- *Recuperar la contraseña:* `resetPasswordForEmail` manda un link que vuelve a `/auth/nueva-contrasena`. En web, Supabase lee el link al crear el cliente y emite `PASSWORD_RECOVERY`; la app se suscribe al cargar el módulo (`src/features/auth/recuperacion.ts`), antes de montar, y ahí se elige la contraseña con `updateUser`. El mensaje al pedir el link es el mismo exista o no la cuenta.
- *Términos:* al registrarse con email, la casilla manda la versión aceptada en `user_metadata` y `handle_new_user` la guarda en `perfiles` con la fecha, si es la vigente. Quien entra con Google, o aceptó una versión anterior, acepta con `aceptar_terminos` antes de publicar, avisar, cambiar un estado, escribir o denunciar. La base lo exige en esas RPC y en las políticas de INSERT de `mensajes` y `denuncias`.
- *Perfil:* el nombre público (2 a 40) y la foto, que se comprime como las de los casos y va a `fotos/<uid>/`; un trigger exige que sea de esa carpeta.
- *Borrar la cuenta:* la app pide `fotos_para_borrar` (las de la carpeta del usuario menos las de lo que queda publicado), las borra con la API de Storage y llama a `borrar_mi_cuenta`, que aplica `limpiar_cuenta` y borra el usuario de Auth (solo el de `auth.uid()`). La persona elige si sus casos abiertos y lo que aportó a casos abiertos de otros quedan publicados sin autor (por defecto) o se borran; todo lo demás se borra, también el contacto de resguardo y el de la familia. Si se borra un usuario desde el panel de Supabase, un trigger en `perfiles` aplica la opción por defecto.

## Modelo de datos

| Tabla | Rol | Notas |
|---|---|---|
| `perfiles` | datos públicos del usuario | 1 a 1 con `auth.users`, creado por trigger. `es_moderador` se asigna por SQL. Sin email ni teléfono. `terminos_version` y `terminos_aceptados_en` no se leen por la API (solo el dueño, con `mis_terminos`). |
| `animales` | el caso | `tipo_reporte`: perdido / encontrado, fijo desde que se publica e independiente del estado. `estado`: avistado / resguardado / reunido / vinculado. `vinculado_a` apunta al principal (si se borra el principal, se borra el unido). `oculto` lo saca del mapa. En los perdidos, `nombre` y `contacto_familia` (opcionales, lo que la familia decide mostrar). `creado_por` es null si quien lo publicó borró su cuenta y lo dejó publicado. |
| `avistamientos` | cada vez que alguien lo vio | `ubicacion geography(Point)`, `visto_en`, `foto_path`, `embedding vector(384)`, `bbox_recorte`, `procesado_en`. El primero es `encontrado` o, en un perdido, `perdido` (visto por última vez, con la ubicación redondeada). `usuario_id` puede ser null (cuenta borrada). |
| `cambios_estado` | historial | `usuario_id` puede ser null (cuenta borrada). |
| `contactos_resguardo` | contacto de quien resguarda | Lo único que un usuario elige publicar de sí mismo al resguardar. En un encontrado lo ve cualquiera; en un perdido, o en un encontrado unido a un perdido, solo la familia y quien lo resguarda (RLS). Se borra con la cuenta de quien lo dejó. |
| `bloqueos` | quién bloqueó a quién | Cada uno ve y maneja solo los suyos. |
| `seguimientos` | seguir un caso | Define quién recibe novedades. |
| `denuncias` | moderación | Una por usuario y animal. Moderadores las resuelven. |
| `cola_vision` | trabajo pendiente del servicio | Reintentos hasta 5. |
| `config_app` | configuración privada | `vision_url`, `vision_secret`, `umbral_similitud`, `radio_coincidencia_m`, `ventana_coincidencia_dias`, `terminos_version`. Sin acceso desde la API. |
| `coincidencias` | candidatos | Par ordenado único. `similitud`, `distancia_m`, `horas_diferencia`, `estado` pendiente / confirmada / rechazada. Las resueltas calibran el umbral. |
| `push_tokens` | Expo Push | Solo app nativa. |
| `notificaciones` | Actividad in-app | `datos` jsonb con `animal_id`, `coincidencia_id` o `conversacion_id`. `actor_id`: quién lo causó. |
| `conversaciones`, `mensajes` | mensajería interna | Participantes ordenados; RLS solo para ellos. |

Vistas (con `security_invoker`): `animales_mapa` y `animales_detalle` (con `tipo_reporte`, `nombre` y `contacto_familia`; el detalle suma `perdido_desde`), `coincidencias_detalle` (con el tipo, el nombre y quién publicó cada lado), `avistamientos_detalle`, `cambios_estado_detalle` (con `contacto_compartido` filtrado por la RLS de `contactos_resguardo`), `conversaciones_detalle` (con `bloqueada` y `bloqueaste`), `mensajes_detalle`, `denuncias_detalle` (con `cuenta_nueva`), `bloqueos_detalle`, `cola_vision_pendientes` (solo servicio). Las que muestran nombres usan `left join` a `perfiles`: lo que quedó sin autor sigue apareciendo, con el nombre en null.

RPC: `publicar_animal`, `registrar_avistamiento`, `cambiar_estado_animal`, `resolver_coincidencia`, `abrir_conversacion`, `aceptar_terminos`, `mis_terminos`, `fotos_para_borrar`, `borrar_mi_cuenta` (usuarios); `moderar_animal` (moderadores); `guardar_embedding`, `marcar_error_vision` (servicio, `service_role`); `notificar`, `interesados_en`, `es_moderador`, `es_foto_propia`, `version_terminos`, `acepto_terminos`, `exigir_terminos`, `hay_bloqueo_con`, `puede_ver_contacto_resguardo`, `caso_principal`, `caso_abierto`, `limpiar_cuenta` (internas o para políticas).

## Seguridad

- RLS en todas las tablas. Lectura pública de animales, avistamientos, historial y coincidencias; todo lo personal (seguimientos, denuncias, notificaciones, conversaciones, mensajes, tokens) solo para su dueño o participantes.
- Permisos de tabla además de RLS: `anon` y `authenticated` no tienen INSERT, UPDATE ni DELETE sobre `animales`, `avistamientos` ni `cambios_estado`. En `perfiles`, `mensajes`, `notificaciones` y `denuncias` el UPDATE se concede solo sobre las columnas que la app cambia; `es_moderador` se asigna únicamente por SQL. En `mensajes` y `denuncias` también el INSERT está limitado a las columnas que manda la app (`leido_en`, `estado` y `created_at` toman su default).
- Storage: bucket público de lectura; cada usuario escribe solo en `fotos/<uid>/`. `publicar_animal` y `registrar_avistamiento` solo aceptan una foto que exista en esa carpeta (`es_foto_propia`): nada de URLs externas.
- Nada de datos personales en tablas públicas. Contacto por mensajería interna o por lo que la persona decide compartir: `contactos_resguardo` (quien lo resguarda; en un perdido, solo para la familia) y `animales.contacto_familia` (la familia de un perdido). La app muestra este último siempre junto al aviso contra estafas, que aparece en todo caso abierto.
- `perfiles` se lee por columna: id, nombre público, avatar, `es_moderador` y fechas. Los datos de términos no.
- Términos vigentes aceptados para publicar, avisar, cambiar estados, escribir y denunciar, validado en la base.
- Las validaciones con un usuario que puede faltar (casos sin autor) usan `is distinct from`: con `<>` o `not in`, un null hace que la condición no se cumpla y la validación se saltea.
- Borrar la cuenta solo actúa sobre `auth.uid()`. Las fotos se borran con la API de Storage, con la sesión del usuario; nunca por SQL.
- Claves: la `anon` va en la app (pública por diseño); la `service_role` solo en el servicio de visión; `vision_secret` en `config_app` y en el servicio; Google en el dashboard de Supabase.

## Mapa

Estilo `positron` de OpenFreeMap (gratis, sin clave, datos de OpenStreetMap bajo ODbL), descargado una vez por sesión y recoloreado en el cliente con los tokens de mapa del esquema claro u oscuro (`estiloBase.ts` y `recolorearEstilo.ts`). Marcadores como capas de círculos sobre una fuente GeoJSON con clustering: fondo `superficie`, anillo del color del estado y halo para los perdidos; el seleccionado se dibuja aparte con su foto. Recorrido como línea punteada con el último punto en el color del caso. Las capas salen de `estilosCapa.ts`, que recibe la paleta. Colores y medidas en `docs/DISENO.md`. Dos implementaciones con el mismo contrato (`src/components/mapa/tipos.ts`):

- **Web:** `maplibre-gl` (BSD-3) en los `.web.tsx`. El worker se sirve desde `public/`.
- **Nativo:** MapLibre React Native (MIT) en los `.tsx`. Exige development build (no corre en Expo Go).

## Despliegue

Web estática en Vercel: `npx expo export -p web` genera `dist/` (modo `single`; `vercel.json` reenvía todas las rutas a `/`). Variables `EXPO_PUBLIC_*` en Vercel. Supabase en su plan gratuito; migraciones con `supabase db push` o pegadas en el SQL Editor. Servicio de visión en Hugging Face Spaces (ver `services/vision/README.md`).

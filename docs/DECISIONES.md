# Decisiones

Registro de decisiones tomadas y por qué. Agregá una entrada cada vez que elijas entre alternativas.

## 2026-10-17 · Mapa con MapLibre + OpenFreeMap

Elegido sobre `react-native-maps`. Costo cero y sin clave de API; el precio es que exige development build (sin Expo Go). Google Maps en Android habría pedido cuenta de facturación aunque el SDK móvil no cobre.

## 2026-10-17 · Reconocimiento en un microservicio Python (Hugging Face Spaces)

Opciones consideradas: Edge Function con transformers.js (límite de 2 s de CPU en plan gratis, descarga del modelo en cada arranque frío), en el dispositivo (más de 100 MB en la app, embeddings falsificables, obliga a actualizar la app por cada cambio de modelo). El microservicio tiene el ecosistema completo y permite recalcular embeddings al cambiar de modelo. Decisión del dueño del proyecto.

## 2026-10-17 · DINOv2 small para embeddings, detector Apache-2.0

YOLOv8 (AGPL-3.0) queda descartado para una app cerrada. DINOv2 (Apache 2.0) distingue mejor individuos que CLIP (MIT), que es semántico. Se recorta el cuerpo completo; no hay detector de caras de mascotas open source maduro.

## 2026-10-17 · Sesión en AsyncStorage, no en SecureStore

La sesión de Supabase supera el límite práctico de ~2 KB de SecureStore en iOS. AsyncStorage es lo que recomienda Supabase para Expo.

## 2026-10-17 · Filtros del mapa en el cliente

Montevideo tiene un volumen chico de reportes. La app carga hasta 500 animales activos y filtra en memoria. Si crece, los filtros pasan a la query.

## 2026-10-17 · "¿Cuándo lo viste?" con opciones rápidas

Recién / hace 1 h / hace 3 h / hoy temprano / ayer, en vez de un selector de fecha y hora. Menos fricción al publicar desde la calle. Se puede agregar un selector exacto después sin tocar el esquema (`visto_en` es un timestamp).

## 2026-10-17 · Vincular reportes en vez de fusionarlos

Cuando alguien confirma "es el mismo animal", los avistamientos del reporte más nuevo se mueven al más viejo y el nuevo queda `vinculado` con `vinculado_a`. Nada se borra, y la confirmación o el rechazo quedan guardados para ajustar el umbral. La vinculación no se puede deshacer: no hay ninguna función para eso y los avistamientos movidos no guardan de qué reporte venían, así que revertir una vinculación equivocada hoy es trabajo manual en SQL y no siempre se puede reconstruir qué avistamiento era de cuál.

## 2026-10-17 · Todo en la nube: Supabase hosted + web en Vercel

Pedido del dueño del proyecto: nada local. Supabase corre en su plan gratuito en la nube (las migraciones se aplican con `supabase db push` o pegándolas en el SQL Editor) y la app se publica como sitio estático en Vercel (`npx expo export -p web`, salida `single`, rewrite de todas las rutas a `/`). La app nativa queda para después, con EAS Build.

## 2026-10-17 · Mapa web con MapLibre GL JS, nativo con MapLibre React Native

MapLibre React Native no corre en el navegador, así que los componentes de mapa tienen dos implementaciones con el mismo contrato (`MapaReportes`, `MapaSelector`): `.tsx` para Android/iOS y `.web.tsx` con `maplibre-gl` (BSD-3). El estilo de las capas es JSON del style spec compartido (`estilosCapa.ts`). El worker de MapLibre GL se copia a `public/` en `postinstall` porque Metro no lo sirve desde `node_modules`.

## 2026-10-17 · Llamadas salientes desde Postgres con pg_net

Sin servidor propio, los avisos al servicio de visión y los push a Expo salen de triggers con `pg_net`. Es "best effort": si el servicio está dormido, el bucle interno del Space drena la cola más tarde. Evita Edge Functions y webhooks configurados a mano en el dashboard.

## 2026-10-17 · Mensajería por polling, sin Realtime

Los mensajes se refrescan cada 4 s con TanStack Query. Suficiente para la escala del proyecto y evita mantener suscripciones WebSocket en web y nativo. Si hace falta, Supabase Realtime se puede sumar sin cambiar el esquema.

## 2026-10-17 · Push solo en nativo; en web, pestaña Actividad

Expo Notifications no cubre web push. Las notificaciones se guardan siempre en la tabla `notificaciones` (visible en Actividad) y además salen por push a los tokens registrados desde la app nativa, directamente a la Expo Push API (no exige credenciales para el envío básico).

## 2026-10-17 · Moderación mínima sin roles de Auth

`perfiles.es_moderador` se asigna por SQL. Los moderadores ven y resuelven denuncias y ocultan publicaciones (`animales.oculto`); tres denuncias de personas distintas ocultan solas. No hay panel de administración más allá de eso.

## 2026-10-19 · Casos solo por RPC y UPDATE limitado por columna

Las políticas de UPDATE filtraban filas pero no columnas: cualquiera podía ponerse `es_moderador = true` en su propio perfil, y quien publicaba podía cambiar a mano `estado`, `vinculado_a` u `oculto` de su animal o insertar historial falso en `cambios_estado`, salteando las validaciones de las RPC. Desde la migración 0007, `anon` y `authenticated` no tienen INSERT, UPDATE ni DELETE sobre `animales`, `avistamientos` ni `cambios_estado`: todo pasa por funciones `security definer` que validan las reglas. `publicar_animal` y `registrar_avistamiento` dejaron de ser `security invoker`, y el panel de moderación oculta o muestra con `moderar_animal`. Donde la app sí escribe directo, el UPDATE se concede solo sobre la columna que cambia: `perfiles` (`nombre_publico`, `avatar_path`), `mensajes` (`leido_en`), `notificaciones` (`leida_en`) y `denuncias` (`estado`). Se eligieron permisos por columna en vez de triggers que rechacen cambios: son más simples y Postgres los controla antes que RLS. Las tablas nuevas en `public` reciben los permisos por defecto de Supabase (todo para `anon` y `authenticated`), así que cada migración que cree una tabla tiene que revocar lo que no corresponda.

## 2026-10-19 · INSERT también limitado por columna en mensajes y denuncias

La 0007 acotó los UPDATE, pero los INSERT seguían aceptando cualquier columna: un mensaje podía llegar con `leido_en` ya puesto (no suma a "no leídos") o con `created_at` inventado, y una denuncia podía crearse ya `descartada`, fuera de la cola de moderación. La migración 0008 concede INSERT solo sobre las columnas que manda la app (`mensajes`: `conversacion_id`, `emisor_id`, `cuerpo`; `denuncias`: `animal_id`, `avistamiento_id`, `usuario_id`, `motivo`, `detalle`). El resto toma su default. Es el mismo criterio de la entrada anterior: permisos por columna antes que triggers.

## 2026-10-19 · Seguir un caso con upsert que ignora duplicados

`seguimientos` no tiene política de UPDATE (seguir es crear o borrar la fila), así que el upsert de "Seguir" fallaba con error de RLS cuando la fila ya existía. Pasa, por ejemplo, después de "Lo vi acá también", que te hace seguir el caso. Se eligió `ignoreDuplicates: true` (`on conflict do nothing`) en vez de agregar una política de UPDATE: no hay nada que actualizar, y una política de UPDATE abriría la puerta a cambiar `animal_id` o `usuario_id`. Además, registrar un avistamiento o cambiar el estado invalida la consulta de seguimiento para que el botón muestre "Siguiendo".

## 2026-10-19 · Preset "Other" en el proyecto de Vercel

Al importar el repo, Vercel detecta **FastAPI** por el servicio de visión (`services/vision/`) y corre un build de Python que falla en `uv pip install`. `vercel.json` ya tiene `"framework": null`, pero en ese deploy ganó el preset guardado en el proyecto. El preset se fija en **Other** en la configuración del proyecto (Settings → Build and Deployment) y el README lo indica al importar. El servicio de visión se despliega aparte, en Hugging Face Spaces.

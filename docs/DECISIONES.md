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

Cuando alguien confirma "es el mismo animal", los avistamientos del reporte más nuevo se mueven al más viejo y el nuevo queda `vinculado` con `vinculado_a`. Nada se borra, se puede deshacer, y la confirmación o el rechazo quedan guardados para ajustar el umbral.

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

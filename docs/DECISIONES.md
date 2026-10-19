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

## 2026-10-19 · Paleta "Calma oliva": oliva y negro sobre blancos cálidos

La app se usa en momentos de angustia, así que busca calma y claridad. Verde oliva (`#556B2F`) para la acción principal y lo que está a salvo (encontrado, resguardado); negro para el texto y un solo elemento destacado por pantalla (filtro activo, botón Publicar, clusters); naranja reservado para los perdidos (Fase 6). Las fotos de los animales son lo único con color fuerte. La especie deja de tener color (`ColorEspecie` y `ColorEstado` se eliminan): se muestra como texto en un chip de datos. Todo texto supera 4,5:1 de contraste, y perdido y encontrado no se distinguen solo por el color: el marcador de un perdido lleva halo, para personas con daltonismo. Detalle en `docs/DISENO.md`.

## 2026-10-19 · Fuentes Fredoka y Figtree, con excepción de licencia OFL

Fredoka 600 para títulos y nombres de animales (redondeada, amable) y Figtree 400, 600 y 700 para todo lo demás (muy legible en tamaños chicos). Se instalan con `@expo-google-fonts/fredoka` y `@expo-google-fonts/figtree` y se cargan con `useFonts` en `src/app/_layout.tsx`, manteniendo la pantalla de carga hasta que estén listas; si fallan, se usa la fuente del sistema. Los paquetes son MIT y las fuentes SIL OFL 1.1: OFL permite incluirlas en una app cerrada pero no está en la lista de licencias de `AGENTS.md`, así que el dueño del proyecto aprobó la excepción para fuentes tipográficas. En Android `fontWeight` no elige el peso de una fuente cargada (cada peso es una familia), por eso `tema.ts` define `Fuentes` con la familia exacta de cada variante; en web se agrega una pila de respaldo del sistema con su peso.

## 2026-10-19 · Modo oscuro con preferencia del usuario

Automático (sigue al sistema, por defecto), Claro u Oscuro, en Perfil › Apariencia. La preferencia se guarda en el dispositivo con `zustand` y `persist` sobre AsyncStorage (ya instalados) y funciona sin cuenta. `tema.ts` exporta dos paletas con las mismas claves; `useTema()` combina la preferencia con `useColorScheme()`, y los estilos con color se crean con `crearEstilos` + `useEstilos`, memorizados por esquema. Barra de estado, tema de navegación y fondo del documento web siguen al esquema. Para que la web no destelle en blanco antes de cargar la app, `public/index.html` declara `color-scheme` y lee la preferencia guardada: el navegador pinta su fondo claro u oscuro y la app aplica el color exacto al montar, sin escribir colores fuera de `tema.ts`. La foto de cada animal nunca se oscurece ni se filtra.

## 2026-10-19 · Tres disposiciones de pantalla: compacto, medio y amplio

`useDisposicion()` devuelve `compacto` (menos de 600 px, cualquier celular desde 320), `medio` (600 a 1023: tablets, ventanas angostas, celulares en horizontal en web) o `amplio` (1024 o más: computadoras). En el mapa, compacto usa hoja inferior con carrusel, medio un panel flotante de 360 a la izquierda y amplio un riel de navegación a la izquierda, un panel de casos de 400 y el mapa. Las pestañas de expo-router 58 soportan `tabBarPosition: 'left'`, pero así el riel solo se vería en las cuatro pestañas: el detalle, la conversación, moderación e ingresar son pantallas del stack raíz y lo perderían. Por eso el riel (`RielNavegacion`) se dibuja en el layout raíz cuando la disposición es amplia y la barra de pestañas se oculta; en compacto y medio sigue la barra de abajo (`BarraNavegacion`). El detalle pasa a una columna centrada de 640 en medio y a dos columnas de hasta 1120 en amplio; el resto de las pantallas usa una columna centrada con ancho máximo. Se descartó un diseño único "estirado": en computadora desperdicia el ancho y en celular chico desborda. La app nativa sigue fija en vertical y sin tablets hasta la Etapa 3.

## 2026-10-19 · Estilo del mapa: Positron recoloreado en el cliente

El mapa pasa de Liberty a Positron de OpenFreeMap, el más limpio, recoloreado con los tokens de mapa de cada esquema. En vez de copiar el JSON del estilo al repo, la app lo descarga una vez por sesión y le cambia los colores por tipo de capa del esquema OpenMapTiles (tierra, calles, avenidas, parques, agua, edificios, límites y etiquetas con su halo). Así el repo no carga 40 KB de estilo que habría que actualizar a mano, `EXPO_PUBLIC_MAP_STYLE_URL` sigue sirviendo para cambiar el estilo base, y si un estilo no tiene las capas esperadas o la descarga falla, se usa tal cual. Web y nativo usan la misma función (`src/components/mapa/estiloBase.ts`), igual que `estilosCapa.ts`, que ahora recibe la paleta como parámetro. Al cambiar de esquema, el mapa cambia de estilo sin perder posición ni selección.

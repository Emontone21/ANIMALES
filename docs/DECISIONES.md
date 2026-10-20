# Decisiones

Registro de decisiones tomadas y por qué. Agregá una entrada cada vez que elijas entre alternativas.

## 2026-10-17 · Mapa con MapLibre + OpenFreeMap

Elegido sobre `react-native-maps`. Costo cero y sin clave de API; el precio es que exige development build (sin Expo Go). Google Maps en Android habría pedido cuenta de facturación aunque el SDK móvil no cobre.

## 2026-10-17 · Reconocimiento en un microservicio Python (Hugging Face Spaces)

Opciones consideradas: Edge Function con transformers.js (límite de 2 s de CPU en plan gratis, descarga del modelo en cada arranque frío), en el dispositivo (más de 100 MB en la app, embeddings falsificables, obliga a actualizar la app por cada cambio de modelo). El microservicio tiene el ecosistema completo y permite recalcular embeddings al cambiar de modelo. Decisión del dueño del proyecto.

Desde el 20 de octubre de 2026 corre en Google Cloud Run: ver "El servicio de visión pasa a Cloud Run".

## 2026-10-17 · DINOv2 small para embeddings, detector Apache-2.0

YOLOv8 (AGPL-3.0) queda descartado para una app cerrada. DINOv2 (Apache 2.0) distingue mejor individuos que CLIP (MIT), que es semántico. Se recorta el cuerpo completo; no hay detector de caras de mascotas open source maduro.

## 2026-10-17 · Sesión en AsyncStorage, no en SecureStore

La sesión de Supabase supera el límite práctico de ~2 KB de SecureStore en iOS. AsyncStorage es lo que recomienda Supabase para Expo.

## 2026-10-17 · Filtros del mapa en el cliente

Montevideo tiene un volumen chico de reportes. La app carga hasta 500 animales activos y filtra en memoria. Si crece, los filtros pasan a la query.

## 2026-10-17 · "¿Cuándo lo viste?" con opciones rápidas

Recién / hace 1 h / hace 3 h / hoy temprano / ayer, en vez de un selector de fecha y hora. Menos fricción al publicar desde la calle. Se puede agregar un selector exacto después sin tocar el esquema (`visto_en` es un timestamp).

## 2026-10-17 · Vincular reportes en vez de fusionarlos

Cuando alguien confirma "es el mismo animal", los avistamientos del reporte más nuevo se mueven al más viejo y el nuevo queda `vinculado` con `vinculado_a` (desde la Fase 6, si el par incluye un perdido, el perdido queda siempre como principal: ver "Quién cierra un caso y quién confirma una coincidencia"). Nada se borra, y la confirmación o el rechazo quedan guardados para ajustar el umbral. La vinculación no se puede deshacer: no hay ninguna función para eso y los avistamientos movidos no guardan de qué reporte venían, así que revertir una vinculación equivocada hoy es trabajo manual en SQL y no siempre se puede reconstruir qué avistamiento era de cuál.

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

`perfiles.es_moderador` se asigna por SQL. Los moderadores ven y resuelven denuncias y ocultan publicaciones (`animales.oculto`); tres denuncias de personas distintas ocultan solas (desde la Fase 7, solo cuentan las de cuentas con al menos 7 días: ver "Denuncias: la edad de la cuenta al denunciar"). No hay panel de administración más allá de eso.

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

## 2026-10-19 · Perdidos y encontrados en la misma tabla

La familia que perdió un animal publica en `animales`, igual que quien encuentra uno, con `tipo_reporte` (`perdido` o `encontrado`). Así reutilizan sin cambios el mapa, los avistamientos, los seguimientos, la mensajería y las coincidencias. Se descartó una tabla aparte de "búsquedas": habría duplicado todo eso y las coincidencias tendrían que cruzar dos tablas. El tipo es independiente del estado (un perdido también pasa por avistado, resguardado, reunido o vinculado), queda fijo desde que se publica y los existentes quedaron como `encontrado`. `nombre` (hasta 40) y `contacto_familia` (hasta 200) son opcionales; un CHECK impide `contacto_familia` en un encontrado, porque quien encuentra no conoce a la familia. No hay campo de recompensa.

## 2026-10-19 · publicar_animal con p_tipo, en vez de una RPC nueva

Se agregaron `p_tipo`, `p_nombre` y `p_contacto_familia` a `publicar_animal`, con default (`encontrado` y null). Una sola función mantiene en un solo lugar las validaciones (cuenta, ubicación, foto propia) y el alta atómica de animal más primer avistamiento; con dos, cada regla nueva habría que escribirla dos veces. Además, una app que todavía no se actualizó sigue publicando encontrados igual mientras se despliega la versión nueva: PostgREST resuelve la llamada por nombre de parámetros y los nuevos tienen default. Hubo que borrar la firma vieja y crear la nueva (agregar parámetros cambia la firma), y la nueva declara `security definer` explícitamente.

## 2026-10-19 · La ubicación de un perdido se redondea en la base

El lugar donde vieron por última vez a un perdido suele ser la casa de la familia. `publicar_animal` lo guarda con latitud y longitud redondeadas a 3 decimales (unos 100 m), y el formulario avisa que no hace falta marcar la casa exacta. Se redondea en la base y no en la app para que ningún cliente pueda saltearlo. Los avistamientos posteriores ("Lo vi") se guardan con precisión: son de otras personas en la calle.

## 2026-10-19 · Quién cierra un caso y quién confirma una coincidencia

Hasta la Fase 5, cualquier usuario con cuenta podía marcar un caso como reunido y confirmar coincidencias. Ahora depende del tipo:
- **Perdido:** solo su familia (quien lo publicó) lo marca como reunido o lo reabre, también cuando "se volvió a escapar". Cualquiera puede avisar que lo vio o que lo tiene resguardado.
- **Encontrado:** lo marca como reunido quien lo publicó o quien lo tiene resguardado (el autor del último pase a resguardado); "se volvió a escapar" sigue abierto a cualquiera (desde la Fase 7, solo quien lo publicó o quien lo tiene resguardado), y reabrir un caso cerrado, solo quien lo publicó.
- **Coincidencias:** si el par incluye un perdido, solo su familia confirma o rechaza; entre dos encontrados, quien publicó cualquiera de los dos o un moderador. Al confirmar, el perdido queda siempre como principal (es el caso que la familia sigue); entre dos encontrados, el más viejo, como antes.

Además, si el secundario estaba resguardado y el principal no, el principal pasa a resguardado con el mismo contacto: así la familia ve enseguida quién tiene a su animal, en vez de encontrarlo solo en el historial. La app muestra las acciones con las mismas reglas, y quien no puede decidir una coincidencia ve un mensaje de espera. A la familia de un perdido no se le ofrece "Me lo llevé / está resguardado" sobre su propio animal, aunque la base lo permitiría.

## 2026-10-19 · Qué coincidencias no se sugieren

`guardar_embedding` no sugiere nunca un perdido con otro perdido (son dos familias buscando, no hay nada que unir) ni un encontrado cuyos avistamientos son todos de más de un día antes de la pérdida: ese animal ya andaba suelto antes de que el otro se perdiera. El día de margen cubre que la familia no sepa la hora exacta (el formulario pregunta en días) y las diferencias de zona horaria. La fecha de la pérdida es la del avistamiento `perdido`. Las demás condiciones (misma especie, casos abiertos, radio y ventana de tiempo, umbral) no cambian.

## 2026-10-19 · Fotos solo desde el bucket propio

`publicar_animal` y `registrar_avistamiento` aceptaban cualquier `p_foto_path`, incluida una URL externa que la app mostraba tal cual: se podía publicar una imagen que nunca pasó por Storage. Ahora exigen que la ruta empiece con la carpeta del usuario (`<uid>/`) y que el objeto exista en `storage.objects` del bucket `fotos` (función interna `es_foto_propia`). Mirar `storage.objects` y no solo el prefijo evita publicar con una ruta inventada. Los datos de demo con URLs externas se cargan directo por SQL, sin pasar por las RPC.

## 2026-10-19 · El valor 'perdido' del enum va en una migración aparte

Postgres no deja usar un valor de enum en la misma transacción en que se agrega ("New enum values must be committed before they can be used"), y `supabase db push` corre cada archivo en una transacción. Por eso `alter type tipo_avistamiento add value 'perdido'` va solo en la 0009 y todo lo que lo usa, en la 0010. En el SQL Editor también hay que ejecutarlas por separado.

## 2026-10-19 · Operador de pgvector calificado en guardar_embedding

`guardar_embedding` corre con `search_path = ''`, y el operador de distancia coseno `<=>` vive en el esquema `extensions`, donde se instaló pgvector. Sin calificarlo, la función fallaba siempre con "operator does not exist", así que el reconocimiento nunca llegó a guardar un embedding; no se notó porque el servicio de visión todavía no estaba conectado. La 0010 lo escribe `operator(extensions.<=>)`. Se eligió calificar el operador en vez de sumar `extensions` al `search_path`: con `search_path` vacío, otra función u operador con el mismo nombre no puede colarse.

## 2026-10-19 · Lo que queda de una cuenta borrada, sin autor (usuario null)

Antes, borrar un usuario borraba en cascada todos sus casos, incluso los abiertos que una familia podía estar mirando. Para que puedan quedar publicados sin autor, `animales.creado_por`, `avistamientos.usuario_id` y `cambios_estado.usuario_id` aceptan null y su clave pasa a `on delete set null`. Se descartó un perfil fijo "Usuario eliminado": `perfiles.id` apunta a `auth.users`, así que habría hecho falta un usuario de Auth inventado, y todos los casos huérfanos parecerían de la misma persona. Con null, las vistas usan `left join` a `perfiles` y la app muestra "una cuenta eliminada". Lo que no cambia: seguimientos, denuncias, tokens, notificaciones, conversaciones, mensajes y bloqueos siguen en cascada; `coincidencias.resuelta_por` sigue en set null. Revisar todas las claves una por una dejó a la vista otro riesgo: con un usuario null, comparaciones como `v_uid <> v_creador` dan null y la validación se saltea. Desde la 0011, esas comparaciones usan `is distinct from`, y las pruebas de la Fase 7 lo cubren.

## 2026-10-19 · Qué se borra y qué queda al borrar la cuenta

Una sola elección para los encontrados abiertos y para lo aportado a casos abiertos de otros: quedan publicados sin autor (por defecto, para no perjudicar a una familia que busca) o se borran. "Abierto" es que el caso principal, siguiendo `vinculado_a`, esté avistado o resguardado: un reporte propio unido a un caso abierto de otro se trata como abierto. Todo lo demás se borra:
- **Perdidos propios, aunque estén abiertos.** Un perdido sin familia no lo puede cerrar ni reabrir nadie, y nadie puede confirmar sus coincidencias, porque solo la familia reconoce a su animal: quedaría en el mapa para siempre. Ajuste pedido en la revisión de la Fase 7; la pantalla de borrar la cuenta lo avisa antes de confirmar.
- **Casos cerrados propios, con todo lo que tienen**, aunque incluyan avistamientos de otras personas y los reportes de otros que se unieron a ellos (`vinculado_a` pasa a `on delete cascade`). También se borran las conversaciones sobre esos casos, como cualquier caso borrado.
- **Avistamientos y cambios de estado propios en casos cerrados de otros.** Se recalcula `ultimo_avistamiento_en` del caso.
- **Siempre:** el contacto de resguardo y el `contacto_familia`, aunque el caso quede publicado.
- **Por cascada al borrar el perfil:** seguimientos, notificaciones (las propias y las que causó), tokens, denuncias hechas, bloqueos, conversaciones y mensajes. Las conversaciones se borran enteras: sin la otra persona no hay con quién hablar.

La lógica vive en `limpiar_cuenta`, que usan `borrar_mi_cuenta` (con la elección) y un trigger `before delete` en `perfiles` (con la opción por defecto), para que borrar desde el panel de Supabase deje la base igual de prolija. Así, lo único que puede quedar sin autor son encontrados y aportes a casos de otros. Un encontrado anónimo lo puede cerrar quien lo resguarda, y si no lo resguarda nadie, un moderador lo puede ocultar.

## 2026-10-19 · Fotos de una cuenta borrada: primero Storage, después la base

Supabase no deja borrar filas de `storage.objects` por SQL, así que las fotos las borra la app con la API de Storage y la sesión del usuario (la política ya permite borrar lo propio). El orden es: `fotos_para_borrar` devuelve las fotos de la carpeta del usuario menos las de lo que queda publicado, la app las borra, y recién después llama a `borrar_mi_cuenta`. Así, si falla una foto, la cuenta sigue entera y se puede reintentar; al revés, con el usuario ya borrado, Storage podría rechazar el token y quedarían fotos huérfanas en un bucket público. La lista sale de `storage.objects`, así que incluye la foto de perfil y las subidas que nunca llegaron a publicarse. Si alguien cierra o reabre un caso entre los dos pasos, puede quedar una foto de más o faltar una; es una ventana de segundos.

## 2026-10-19 · Contacto de resguardo en una tabla con RLS

En un perdido, el contacto de quien lo resguarda lo ven solo la familia y esa persona. `cambios_estado` es de lectura pública, así que no alcanzaba con ocultarlo en la app. Se movió a `contactos_resguardo`, con una política de lectura según el caso: en un encontrado lo ve cualquiera, como antes; en un perdido, o en un encontrado unido a un perdido, solo la familia, quien lo resguarda y quien publicó el encontrado. `cambios_estado_detalle` lo une con `left join`, así que la app sigue leyendo `contacto_compartido` y le llega null cuando no corresponde. Se descartaron los permisos por columna (la vista con `security_invoker` dejaba de poder leerse entera) y una vista `security definer` (esquiva RLS y Supabase la marca como riesgo).

## 2026-10-19 · Resguardar un perdido pide una foto actual

La estafa típica es decir que se tiene al animal y pedir plata. Para pasar un perdido a resguardado, `cambiar_estado_animal` exige ahora una foto subida desde la app (`es_foto_propia`), que se guarda en el avistamiento de resguardo y entra a la cola de reconocimiento. En un encontrado la foto es opcional en la base y la app no la pide. La nota del resguardo sigue siendo pública: el formulario avisa que no se ponga el contacto ahí. Además, en un encontrado, "se volvió a escapar" (resguardado a avistado) queda para quien lo publicó o quien lo resguarda: antes podía decirlo cualquiera.

## 2026-10-19 · Términos: versión en la base, casilla al registrarse

La versión vigente está en `config_app.terminos_version` y, para los textos, en `VERSION_TERMINOS` de la app. Al registrarse con email, la versión aceptada viaja en `user_metadata` y la guarda `handle_new_user`, porque con confirmación de email todavía no hay sesión para llamar a una RPC. Quien entra con Google, o aceptó una versión anterior, acepta con `aceptar_terminos`, que rechaza una versión que no sea la vigente. Se exigen en la base para publicar, avisar que lo viste, cambiar el estado, escribir y denunciar; no para seguir un caso, confirmar coincidencias, editar el perfil, bloquear ni borrar la cuenta, que no publican nada o protegen al usuario. `perfiles` pasó a leerse por columna para que nadie vea cuándo aceptó otra persona; la app ya no hace `select *` sobre `perfiles`. Los textos son un borrador para que los revise el dueño del proyecto.

## 2026-10-19 · Bloqueos en los dos sentidos y avisos con actor

Un bloqueo corta los mensajes en los dos sentidos: quien está bloqueado no puede escribir, y quien bloquea tampoco hasta desbloquear, para que no haya conversaciones donde solo uno puede hablar. A quien bloquean no se le avisa; si intenta escribir, ve "No podés escribir en esta conversación". Para que quien bloquea deje de recibir avisos de esa persona, `notificaciones` guarda quién causó cada aviso (`actor_id`, en cascada con su perfil) y `notificar` lo recibe. El mismo dato hace que, al borrar una cuenta, desaparezcan los avisos que llevaban su nombre o el texto de sus mensajes.

## 2026-10-19 · Denuncias: la edad de la cuenta al denunciar

Para ocultar sola una publicación cuentan las denuncias de cuentas que tenían al menos 7 días cuando denunciaron (`perfiles.created_at` contra `denuncias.created_at`). Contar la edad actual habría hecho valer, una semana después, las denuncias de cuentas creadas para tirar una publicación. Los moderadores siguen viendo todas, con la marca "Cuenta nueva" en las que no cuentan.

## 2026-10-19 · Recuperar la contraseña en web

`resetPasswordForEmail` manda un link que vuelve a `/auth/nueva-contrasena`. En web, el cliente de Supabase procesa el link al crearse y emite `PASSWORD_RECOVERY` antes de que la app termine de montar (espera las fuentes). Por eso la suscripción va al cargar el módulo (`src/features/auth/recuperacion.ts`) y no en un efecto de React. El mismo módulo lee la URL antes de que el cliente la limpie: así detecta un link vencido, que no emite ningún evento, y si Supabase manda el link a la raíz, la app igual lleva a elegir la contraseña nueva. En nativo, el deep link pasa por `crearSesionDesdeUrl`, que marca la recuperación cuando trae `type=recovery`.

## 2026-10-19 · Miniaturas junto a la original, con la convención en un solo lugar

Cada foto se sube con una miniatura cuadrada de 320 px en la misma carpeta: `<uid>/<uuid>.jpg` y `<uid>/<uuid>.miniatura.jpg`. El nombre se arma solo en `src/lib/imagenes.ts` (`rutaMiniatura`), que no importa nada de React ni de Expo para que también lo use la función de la vista previa. La base guarda solo la ruta de la original: no hizo falta tocar `publicar_animal`, `registrar_avistamiento`, `cambiar_estado_animal` ni el avatar.

Para saber si una foto tiene miniatura, quien la muestra la pide y, si no carga, pasa a la original (`FotoMiniatura`, y lo mismo en los marcadores web). Se descartaron una columna en la base y consultar `storage.objects`: habría que cambiar cuatro RPC y las fotos viejas igual necesitarían un camino de respaldo. El costo es un pedido fallido por foto vieja; hoy en producción no hay ninguna (las de demo son URLs externas y van directo a la original).

Para no borrar la miniatura de lo que queda publicado, la base solo sabe que una foto y sus variantes comparten la ruta hasta el primer punto (`raiz_foto`, migración 0012). `fotos_para_borrar` y `fotos_del_reporte` comparan por esa raíz. El sufijo `.miniatura.jpg` sigue estando solo en la app.

## 2026-10-19 · Foto en todos los marcadores: marcadores de vista sobre una zona táctil

DISENO.md 6.6 pide la foto en todos los marcadores. En web cada punto suelto que se ve es un `Marker` de MapLibre GL JS con un elemento del DOM; en nativo, un `Marker` de MapLibre React Native con `MarcadorFoto`. Los clusters siguen siendo capas de círculos. Debajo de cada foto queda una capa de círculos casi transparente (`animales-punto`), corrida hasta donde está la foto: recibe el toque igual que antes y, al consultarla, dice qué puntos sueltos se ven. Así la regla de qué se dibuja es la misma en las dos plataformas.

Se descartó una capa de símbolos con la foto como ícono: en web obliga a recortar cada foto en un canvas (y una URL de demo sin cabeceras CORS lo rompe) y en nativo no hay forma de recortarlas en círculo. Con marcadores de vista, el recorte, el anillo y el halo son estilos comunes. El costo es un elemento por punto visible: con el clustering, a cualquier zoom son pocas decenas. La opacidad de la zona táctil es 0,01 y no 0: con 0, MapLibre nativo puede no dibujar la capa y entonces no responde al toque.

## 2026-10-19 · Editar y borrar un reporte: solo quien lo publicó

`editar_reporte` y `borrar_reporte` son RPC `security definer` que validan con `reporte_propio`: quien llama es quien publicó (con `is distinct from`, así un caso sin autor no lo cambia nadie) y el reporte no se unió a otro caso. Un reporte unido ya es parte del caso principal: sus avistamientos pasaron allá y borrarlo se llevaría la confirmación que calibra el umbral.

- **Qué se edita:** especie, tamaño, color, collar y descripción; en un perdido, también nombre y contacto de la familia. El tipo, la ubicación y las fotos quedan fijos. Editar pide los términos, como publicar, porque publica texto nuevo; borrar no, como borrar la cuenta.
- **Cambio de especie:** las coincidencias se buscan dentro de la misma especie, así que las pendientes se descartan con sus avisos y las fotos del caso vuelven a la cola de reconocimiento. Las resueltas quedan: son decisiones de una persona. Lo decidí yo: el pedido no lo mencionaba, y sin esto una especie corregida dejaba sugerencias equivocadas y no buscaba las buenas.
- **Qué se borra:** la misma lógica que `limpiar_cuenta` usa para un caso, ahora en una función compartida (`borrar_casos`, sobre `arbol_de_casos`): el caso y los reportes unidos a él, con todo lo que cuelga, también los avistamientos de otras personas. `limpiar_cuenta` pasó a llamarla, con la misma regla de la Fase 7; las pruebas de la Fase 7 lo cubren.
- **Avisos:** además de los que llevaban al caso (`animal_id`), `borrar_casos` borra los que hablan de sus coincidencias o sus conversaciones, que antes quedaban apuntando a algo que ya no existe. Vale también al borrar una cuenta.
- **Fotos:** como al borrar la cuenta, primero la app borra con la API de Storage las fotos propias del caso con sus miniaturas (`fotos_del_reporte`, que deja afuera las que algo fuera del caso usa) y después llama a la RPC. Las de otras personas quedan en Storage.

## 2026-10-19 · Compartir: la hoja del sistema y, si no hay, WhatsApp y copiar

El botón Compartir del detalle usa `navigator.share` en web y `Share` en nativo. En web el link va aparte del texto y la app elegida lo pone después; en nativo va dentro del mensaje, porque Android ignora el campo `url` y en iOS, con los dos, sale repetido. Si no hay hoja de compartir (la mayoría de las computadoras), o falla por otra cosa que no sea que la persona la cerró, aparece una hoja con "Mandar por WhatsApp" (`https://wa.me/?text=`) y "Copiar el link", con el link a la vista por si copiar no funciona. El texto depende del tipo y del estado y sale de `t.compartir`. Un caso oculto por moderación no muestra el botón. El link usa `EXPO_PUBLIC_SITE_URL`, con `https://animales-blue.vercel.app` por defecto: los links compartidos desde una preview también llevan a producción.

## 2026-10-19 · Vista previa del link: primera pieza de servidor propia, solo para bots

La web es una sola página: todas las rutas devuelven el mismo `index.html`, así que WhatsApp, Facebook y Telegram mostraban una vista previa genérica. Ninguna opción sin servidor resuelve eso: los bots no ejecutan JavaScript. Se sumó una función de Vercel, `api/vista-previa.ts`: la primera pieza de servidor propia del proyecto. Es TypeScript sin dependencias (`fetch` y `Response` del runtime de Node) y reutiliza los textos de `es-UY.ts`, la convención de miniaturas y el armado del link. Lee el caso con la clave anon, como la app, y devuelve el `index.html` del mismo deploy con las etiquetas Open Graph y Twitter.

**Solo para bots.** `vercel.json` reescribe `/animal/<id>` a la función solo si el user-agent es de un bot de vista previa conocido (WhatsApp, Facebook, Telegram, X, Slack, LinkedIn, Discord, Teams, iMessage, Google, Bing y otros). Las personas reciben el `index.html` estático desde la CDN, como siempre. Así la función no suma demora ni un punto de falla al abrir un caso: si se cae, solo se pierde la vista previa. El costo es mantener la lista de bots: uno que no esté recibe la página de siempre y muestra la vista previa genérica. Se descartó servirla a todos: cada visita pasaría por la función y por Supabase antes de mostrar la app.

**Sin datos personales.** Título y descripción salen de los datos estructurados (tipo, estado, nombre del animal, especie, color, tamaño, collar). Nunca el contacto, quién publicó, la ubicación ni la descripción libre, donde alguien pudo haber escrito un teléfono o una dirección. A la base solo se le piden esas columnas. Un caso oculto, unido a otro o inexistente lleva las etiquetas genéricas.

**Detalles.** La imagen es la miniatura de 320 (con `twitter:card` `summary`, que la muestra chica y cuadrada); si no existe, la original. El `index.html` se pide al propio deploy con un user-agent que no es de bot y se guarda cinco minutos en memoria; si no se puede leer, la función devuelve una página mínima con las etiquetas y sin caché. La respuesta queda cinco minutos en la CDN: una edición se ve en la vista previa a los pocos minutos (cada red, además, guarda la suya).

## 2026-10-19 · .vercelignore para el servicio de visión

Con la carpeta `api/`, Vercel empieza a construir funciones. Para que nunca vuelva a detectar Python por `services/vision/` (ver "Preset Other en el proyecto de Vercel"), `.vercelignore` deja afuera `services/`: Vercel ni siquiera recibe esos archivos. El preset del proyecto sigue en Other.

## 2026-10-19 · Lista de casos con los filtros del mapa

"Ver lista" en la hoja "Cerca tuyo" abre `/casos`: todos los casos con los filtros activos, del más cercano al más lejano al centro del mapa. Los filtros y el centro pasaron de estado local del mapa a un store de zustand en memoria (`useFiltrosMapa`), compartido por las dos pantallas: si se cambia un filtro en la lista, el mapa también cambia. Se descartó pasarlos por la URL: habría dos copias que mantener iguales. No se guardan en el dispositivo: al recargar vuelven a los iniciales, como antes. En tablets y computadoras la lista ya está en el panel lateral, así que "Ver lista" aparece solo en la hoja del celular.

## 2026-10-19 · Con quién se abre una conversación

> **Nota:** esta entrada reemplaza a la de la Fase 9, parte 1 (migración 0013), que descartaba escribirle a quien avisó que lo vio. La parte 2 (migración 0014) lo suma, solo para quien publicó el caso.

La app siempre ofreció escribirle a quien publicó el caso o a quien lo resguarda, pero `abrir_conversacion` aceptaba cualquier usuario: como los perfiles son públicos, cualquiera con cuenta podía escribirle a todos (y mandarles un aviso con el texto). Desde la 0013 la otra persona tiene que haber publicado el caso (o un reporte unido a él) o haberlo resguardado alguna vez.

Desde la 0014, además, quien publicó el caso o un reporte unido a él le puede escribir a quien avisó que lo vio en cualquier reporte del caso (todo el árbol de reportes unidos, desde el principal). En el Historial, cada aviso de otra persona lleva un botón "Escribirle" que solo ve quien puede usarlo. La familia es quien más necesita preguntar cómo estaba o hacia dónde iba, y antes solo podía esperar a que le escribieran. No se suma el sentido inverso: quien lo vio le escribe a quien publicó, como antes, y un tercero no puede usar el historial para escribirle a cualquiera que aparezca ahí, que era lo que preocupaba en la 0013. Quedan afuera los avisos propios y los de cuentas borradas (sin autor). Valen las mismas condiciones: bloqueos en los dos sentidos, términos aceptados y que el caso no esté oculto. Una conversación que ya existe se puede retomar, así quien publicó le contesta a quien le escribió primero.

## 2026-10-19 · Coincidencias y bloqueos

Los avisos de coincidencias no llevaban actor, así que quien bloqueaba a alguien seguía recibiendo los avisos de los reportes de esa persona. Ahora el actor es quien publicó el otro reporte del par: si la familia bloqueó a quien encontró un animal parecido, no le llega el aviso, pero la coincidencia se sigue viendo en el detalle y la puede confirmar. Un reporte sin autor (cuenta borrada) avisa igual. Efecto a tener en cuenta: si esa persona borra su cuenta, esos avisos se borran con ella, como el resto de sus avisos.

## 2026-10-19 · La ubicación de un resguardo, redondeada

El "¿Dónde está ahora?" de un resguardo se publica como un avistamiento que ve cualquiera, y suele ser la casa de quien tiene al animal. Igual que el punto de un perdido, la base lo guarda con 3 decimales (unos 100 m) y el formulario lo avisa. Alcanza para que la familia sepa la zona; el resto se habla por mensajes o con el contacto que deja quien lo resguarda.

## 2026-10-19 · El bucket de fotos no se lista

Las fotos se ven por su URL pública, que en un bucket público no pasa por la RLS. La política de lectura de `storage.objects` solo servía para listar, y con lectura para todos cualquiera podía listar las carpetas de todos los usuarios, también fotos de casos ocultos o de publicaciones que no se completaron. Ahora cada usuario lee y lista solo su carpeta, que es lo que Storage necesita para subir y borrar lo propio. Hay que confirmar en producción que subir y borrar fotos sigue andando (ver el reporte de la revisión).

## 2026-10-19 · El servicio de visión se avisa desde la cola, con reintentos que esperan

El aviso al servicio salía del trigger de `avistamientos`, así que una foto que volvía a la cola (al corregir la especie) solo se procesaba cuando el bucle del servicio pasaba, o cuando otro avistamiento lo despertaba. Ahora sale de `cola_vision` cada vez que una fila queda pendiente. Los errores se reintentaban cada vez que pasaba el bucle y a los 5 intentos la foto quedaba afuera: una caída de media hora la perdía para siempre. Ahora se espera el doble después de cada error (5, 10, 20… minutos) y hay hasta 8 intentos, unas 10 horas. Además, una foto de un caso cerrado, unido a otro u oculto guarda su embedding pero no busca coincidencias, y un caso oculto nunca se sugiere: antes una publicación ocultada por moderación seguía generando avisos a otras familias.

## 2026-10-19 · Errores en español en todas las pantallas

Las pantallas mostraban `error.message` tal cual: "Failed to fetch" sin conexión, "invalid input syntax for type uuid" con un link roto, errores de Storage en inglés. `mensajeDeError` (`src/lib/errores.ts`) decide qué mostrar: los textos de la app (`ErrorVisible`, como `ErrorAuth`), los avisos de las RPC (códigos 42501, 22023, P0002 con texto en español), "No hay conexión" si es la red, y si no, un texto de respaldo que elige cada pantalla. Auth suma el caso de los límites de Supabase: sin SMTP propio manda pocos mails por hora, y antes ese error decía "Ese email no parece válido".

## 2026-10-19 · Sondeo solo con la pantalla a la vista

Las pestañas quedan montadas, así que la lista de conversaciones y la de novedades se seguían pidiendo fuera de Actividad, y una conversación tapada por otra pantalla seguía pidiendo todos sus mensajes cada 4 s. Ahora cada una se refresca solo mientras su pantalla está en foco (`useIsFocused`), y el punto de "sin leer" de la pestaña pide si hay alguna (una fila), no las últimas 100. Se descartó por ahora pedir solo los mensajes nuevos: cambia cómo se arma la caché y los "leído" de los mensajes viejos dejarían de actualizarse.

## 2026-10-19 · Ubicación en web directo del navegador

En web, `expo-location` pide la posición con antigüedad máxima infinita: con la página abierta, el navegador devuelve la primera posición que obtuvo (por ejemplo, la de casa) aunque la persona se haya movido, y "Usar mi ubicación" guardaba ese punto. Además consulta `navigator.permissions`, que Safari de iPhone anterior a iOS 16 no tiene, y ahí el botón quedaba cargando para siempre. En web, `obtenerPosicionActual` usa `navigator.geolocation` con alta precisión, una antigüedad máxima de 10 s y 15 s de espera; en nativo sigue con `expo-location`.

## 2026-10-19 · Pruebas de la app con jest-expo

`npm run test` corre jest con el preset `jest-expo` del SDK (instalado con `npx expo install`, en la versión que fija `expo`). Se prueba la lógica, no las pantallas: lo que calcula la app pasó a funciones puras (`permisos.ts`, `validaciones.ts`, `errores.ts`) para poder probarlo sin React ni Supabase, y `useAccionesCaso` usa esas funciones. La función de la vista previa se prueba con `fetch` simulado, sin red. Las pantallas se prueban a mano con `docs/PRUEBAS-MANUALES.md`: las pruebas de componentes o de punta a punta quedan para cuando haya una app nativa que probar.

## 2026-10-19 · Un caso oculto deja de verse

Ocultar un caso solo lo sacaba del mapa: por su link y por la API se veía completo, con el contacto de la familia, sus avistamientos y sus coincidencias. Como se oculta por estafa, datos falsos o denuncias, desde la 0014 un caso oculto lo ven solo quien lo publicó y los moderadores, y lo mismo vale para lo que cuelga de él: avistamientos, historial, contactos de resguardo y coincidencias. Las políticas de esas tablas preguntan si quien consulta ve el caso, así que la regla vive en un solo lugar (la política de `animales`) y las vistas, con `security_invoker`, la heredan.

- **Coincidencias:** alcanza con que un lado esté oculto para que terceros no la vean, incluida quien publicó el otro lado: si no, la coincidencia mostraría que el caso oculto existe y su foto.
- **El mismo texto que un caso inexistente:** quien no puede verlo lee "Esta publicación no está disponible.", igual que con un link roto. No se confirma que existe ni que fue moderado.
- **Conversaciones:** las que ya había siguen para sus participantes, porque ahí puede estar el pedido de plata y conviene que se lea con el aviso. En lugar de la tarjeta del caso muestran "Publicación no disponible" y el aviso contra estafas. No se abren conversaciones nuevas. Se descartó borrarlas o cerrarlas: se perdería lo escrito y la persona no entendería qué pasó.
- **Volver a mostrarlo** (`moderar_animal` con `false`) restaura todo: es la misma marca, no se copia ni se borra nada.
- **Quien lo publicó y moderación** lo siguen viendo como antes, con el aviso de que está oculto. El mapa y la vista previa del link lo tratan como inexistente, como ya hacían.

## 2026-10-19 · Atrás cierra la hoja en web

En web, Atrás con una hoja abierta (por ejemplo "Lo vi", con la foto ya elegida) salía de la pantalla y se perdía lo cargado; solo Escape la cerraba. Ahora cada hoja abierta suma una entrada al historial con la misma URL y una marca en `history.state`, y Atrás cierra la de arriba (`useCerrarConAtras` y `src/lib/historialHojas.ts`, usados por `Hoja`, `MenuOpciones` y `SelectorUbicacion`).

Lo delicado es convivir con Expo Router, que también escribe en el historial. Quitar la entrada de una hoja cerrada desde la interfaz es asincrónico (`history.go`), y si en ese momento la app navega, la entrada nueva quedaría detrás de la vieja. Por eso el módulo envuelve `pushState`, `replaceState` y `go`. Mientras se quita una entrada propia, lo que escribe Expo Router espera. Si la app navega con una hoja abierta, primero se quitan sus entradas. Los `popstate` que solo cierran hojas no le llegan a Expo Router, que sigue en la misma entrada.

Se descartó hacer de cada hoja una ruta: cambiaba todas las pantallas que las abren, un link compartido abriría una hoja suelta y el estado del formulario quedaría atado a la URL. El costo de lo elegido es que depende de cómo usa el historial Expo Router (`browserHistoryAdapter`): al actualizar Expo o Expo Router hay que volver a recorrer los flujos de Atrás de `docs/PRUEBAS-MANUALES.md`. En Android, `Modal` ya cierra la hoja con Atrás (`onRequestClose`); en iOS no hay Atrás.

## 2026-10-20 · Carga inicial en el celular: primero lo que se vino a ver

La primera visita, casi siempre desde un link de WhatsApp a un caso, tardaba de 10 a 15 s en mostrar algo, con la pantalla en blanco o en negro. El navegador interno de WhatsApp, Instagram o Facebook no comparte la caché, así que esa carga es la que importa. Las mediciones están en `docs/reportes/2026-10-20-carga.md`. El criterio: lo que se ve sin JS, después los datos y las fotos de la pantalla, y al final el mapa y la tipografía.

- **Pantalla de carga en `index.html`,** solo HTML y CSS, con el fondo de la paleta. Es la única excepción a `tema.ts` y `es-UY.ts`: cada color lleva su token en un comentario y una prueba comprueba que coincidan. Se va cuando la app dibuja contenido, no apenas monta: las pantallas llegan en bloques aparte y entre medio quedaba el fondo vacío.
- **MapLibre en un bloque aparte, cargado al final.** Era 1 MB de los 2,9 MB de la carga inicial. Los tres mapas web salen de un solo módulo (`mapasWeb.ts`): importados por separado, Metro manda lo que comparten al bloque común, que se carga siempre. El mapa espera a que la pantalla muestre sus datos y terminen sus fotos prioritarias. Si arrancaba junto con ellas, su descarga y su arranque demoraban las fotos: sin el mapa en el medio, el LCP simulado bajaba de 9 a 4,7 s.
- **Fuentes sin esperar y al final.** Se descartó precargarlas en `index.html`: con 170 KB competían con el JS en la 4G lenta. También se descartó seguir con `expo-font` en web: dejaba la app en blanco hasta que bajaban (o hasta 12 s) y pedía cada fuente dos veces. Se eligió declararlas en `index.html` con `font-display: swap` y activarlas después de las fotos prioritarias. Hasta entonces el texto usa la fuente del sistema y después cambia solo. Activarlas al final bajó el LCP simulado alrededor de 1 s. En nativo sigue `useFonts`.
- **Datos antes de las pantallas.** `_layout` pide los datos de la ruta de entrada apenas carga (`precarga.ts`), sin esperar a que lleguen sus pantallas. Para que la pantalla no los vuelva a pedir al montar, las consultas del mapa y del detalle se dan por frescas 30 s; publicar, avisar o cambiar un estado invalida lo que cambia.
- **Conexiones abiertas de antemano** a Supabase y OpenFreeMap. La URL de Supabase queda escrita en `index.html`: el export solo reemplaza el título y el idioma.
- **Lo que solo usa una acción se importa al usarla** (subir una foto, la ubicación en nativo). `expo-image-picker` no: en Safari el selector de archivos tiene que abrirse en el mismo toque, sin esperar una descarga.

**Lo que no se hizo:**

- **Ionicons:** la fuente de íconos (390 KB) es hoy lo que más compite con las fotos, pero quedó para otra tarea. El ahorro estimado está en el reporte.
- **El resto del JS inicial** (React, react-native-web y Expo Router, unos 290 KB comprimidos) no se tocó.

## 2026-10-20 · Atributos aria en web

react-native-web 0.21 ya no traduce `accessibilityState`, salvo `disabled`: "seleccionado", "marcado" y "ocupado" no llegaban al lector de pantalla en web. Donde ARIA los permite se usan los atributos `aria-*` de React Native, que andan en web y en nativo:

- `aria-checked` en chips, casillas y opciones;
- `aria-selected` en pestañas;
- `aria-busy` en botones.

En las tarjetas (`link`) y en el botón de seguir (`button`) "seleccionado" queda solo para nativo: ARIA no permite `aria-selected` ahí, y en el botón el nombre ya lo dice ("Siguiendo"). Toda foto lleva texto alternativo: `FotoMiniatura` pide una descripción, el título del caso (`t.animal.tituloCaso`).

## 2026-10-20 · Hoja "Cerca tuyo" plegable con PanResponder y Animated

La hoja del celular tenía alto fijo y tapaba parte del mapa. Ahora tiene dos posiciones, abierta y plegada (solo la barra). Se cambia arrastrando la barra o tocándola. Detalle visual en `docs/DISENO.md`, 6.7.

- **Sin librerías nuevas en la carga inicial.** El arrastre usa `PanResponder` y la posición `Animated`, de React Native: los dos ya estaban en el bloque inicial (los usa react-native-web). `react-native-gesture-handler` está instalado pero no entra en el build web, y sumarlo por esto costaba más que el resto del cambio.
- **La hoja siempre mide lo mismo, y baja:** plegarla es un `translateY` de la hoja (y del botón de mi ubicación). No se anima el alto, que obligaría a rehacer el diseño del carrusel en cada cuadro. El contenedor del mapa recorta lo que queda abajo.
- **Toda la barra es el botón** (con `aria-expanded`, "Ocultar casos" o "Mostrar casos"). "Ver lista" queda encima, y el título deja pasar los toques. El arrastre toma el gesto solo cuando el dedo se movió más de 6 px en vertical. Así un toque sigue siendo del botón y un desliz al costado no es de la hoja.
- **En web, `touch-action: none`** en la barra: Safari de iPhone y Chrome de Android no desplazan la página ni recargan mientras se arrastra. El mapa no recibe el gesto, porque la hoja no está dentro de su contenedor.
- **Los créditos del mapa bajan al soltar**, no durante el arrastre: se ubican con los márgenes del mapa (`margenes.bottom`), que cambian con el estado. En web pasan con una transición de 220 ms. El mapa no cambia su `padding` al plegar, para no saltar; al tocar un marcador con la hoja plegada, la cámara centra con el margen de la hoja abierta (`irA` acepta márgenes).
- **Se recuerda** en el dispositivo, con `zustand` y `persist`, como la apariencia (`encontrados-hoja-cerca`).
- **Las reglas del gesto** (cuándo es arrastre, a qué posición va al soltar) son funciones puras con su prueba (`src/features/mapa/posicionHoja.ts`).

## 2026-10-20 · Instalar la app: manifest y un service worker mínimo

"Instalar la app" en Perfil ofrece lo que cada navegador permite. Las reglas están en `src/features/instalar/formaDeInstalar.ts`, con su prueba:
- **Chrome y Edge:** abren su propia ventana de instalación (`beforeinstallprompt`).
- **iPhone y iPad:** una hoja con los pasos de Compartir.
- **Navegadores de WhatsApp, Instagram y Facebook:** se explica cómo abrir el link en Chrome o Safari.
- **Ya instalada o en la app nativa:** el botón no se muestra.

- **Service worker:** según la documentación de Chrome, desde la versión 108 (Android) y 112 (computadora) instalar desde el menú ya no pide service worker. Pero el aviso `beforeinstallprompt`, que es el que usa el botón, sigue pidiendo uno con un manejador de `fetch` que no esté vacío (Chrome ignora los vacíos). `public/sw.js` es lo mínimo:
  - responde las páginas (navegaciones) siempre desde la red, con *navigation preload* para no demorarlas;
  - no toca nada más: ni JS, ni fotos, ni la API de Supabase;
  - no usa Cache Storage ni funciona sin conexión.

  Se registra cuando termina la carga. Una prueba comprueba que no guarda nada. Con las herramientas de Chrome (`Page.getInstallabilityErrors`) la app queda instalable sin errores.
- **El aviso se guarda en `index.html`:** Chrome lo manda una sola vez y a veces antes de que cargue la app. Un script en el `<head>` lo guarda en `window.__instalar` (con `preventDefault`, que reemplaza la barrita automática de Chrome por el botón de Perfil). También anota `appinstalled`, para no volver a ofrecerla. La app lo lee con `useSyncExternalStore`.
- **iPhone con otros navegadores:** desde iOS 16.4, Chrome y Firefox también agregan a inicio desde Compartir, así que ven los mismos pasos que Safari.
- **Manifest:** nombre y descripción de `es-UY.ts` y colores de `tema.ts` (el `fondo` del claro). Como el JSON no admite comentarios, una prueba comprueba que coincidan. Los íconos (192, 512, maskable de 512 y el de iPhone de 180) los genera `scripts/iconos-web.py` desde `assets/images/icon.png`. Ese ícono sigue siendo el de la plantilla de Expo: el ícono propio es trabajo gráfico pendiente (DISENO.md, sección 10).

## 2026-10-20 · Reportar un error: solo lo lee moderación y la base pone los límites

Cualquiera, con o sin cuenta, puede avisar desde Perfil que algo anda mal. Los reportes van a `reportes_errores` (migraciones 0015 y 0016):

- **Solo por RPC.** `reportar_error` valida, limita y avisa. Desde la API no hay INSERT ni UPDATE: la tabla solo se lee, y solo moderación (RLS con `es_moderador()`). Tampoco la lee quien mandó el reporte: con cuenta, la respuesta le llega a Actividad al resolverse (`resolver_reporte_error`, solo moderación).
- **Límites en la base:**
  - 5 reportes por hora por cuenta;
  - un tope global por hora para los que se mandan sin cuenta (30, en `config_app`), que no frena a quien tiene cuenta.

  Un candado (`pg_advisory_xact_lock`) evita que dos reportes simultáneos pasen el mismo límite. La columna `sin_cuenta` dice cómo se mandó: un reporte de una cuenta borrada queda sin usuario, pero no cuenta como anónimo. El tope sin cuenta lo puede llenar alguien a propósito; lo peor que pasa es que, por una hora, quien no tiene cuenta no puede reportar.
- **No pide los términos:** no publica nada (lo leen solo los moderadores) y sin cuenta no se pueden aceptar. Que justo un error impida aceptarlos tampoco tiene que impedir reportarlo.
- **Contacto solo sin cuenta.** Es el único dato personal, opcional, y lo ven solo los moderadores: la tabla no es pública. Con cuenta no se pide (la base lo rechaza), porque la respuesta llega por Actividad.
- **Capturas en un bucket privado, `capturas`.** Solo se suben con cuenta, a la carpeta propia. Las leen quien la subió y moderación, con un link firmado de una hora. Se comprimen como las fotos (`comprimirFoto`: JPEG de 1280 de ancho), sin miniatura: una captura recortada al centro no sirve. Nunca van al bucket público `fotos`.
- **Al borrar la cuenta:** sus reportes quedan sin autor y sin la ruta de la captura (`limpiar_cuenta`). La app borra antes sus capturas con la API de Storage (`capturas_para_borrar`), como hace con las fotos. Si la 0016 no está aplicada, ese paso se saltea.
- **Avisos:** cada reporte nuevo le avisa a cada moderador, con quien lo mandó como actor, como el resto de los avisos. Quien lo bloqueó no recibe el aviso, pero lo ve en el panel. El aviso de "resuelto" no lleva actor: lo resuelve moderación, no una persona.
- **Lo que suma la app:**
  - la pantalla anterior a Perfil (`src/lib/rutasRecientes.ts`, que anota las rutas en memoria);
  - el user agent;
  - el tamaño de la ventana con la densidad;
  - la plataforma;
  - la versión.

  El formulario lo muestra antes de mandarlo. La base recorta esos datos en vez de rechazar el reporte.

## 2026-10-20 · La versión del deploy, fuera de la carga inicial

El reporte dice qué versión se estaba usando: la de `app.json` más el commit del deploy. El build de Vercel pasa `EXPO_PUBLIC_COMMIT` (de `VERCEL_GIT_COMMIT_SHA`) y `EXPO_PUBLIC_FECHA_BUILD` (`vercel.json`, `buildCommand`). Si no hay commit, se usa la fecha.

Esas dos variables se leen solo en el formulario de errores, que va en un bloque aparte, y no en `src/lib/env.ts`. Si estuvieran en el bloque inicial, cada deploy cambiaría su nombre y todos volverían a bajar los 290 KB de `entry`, aunque el deploy solo cambiara la documentación.

## 2026-10-20 · Bloques aparte y el bloque común de Metro

El formulario de errores, la sección Errores del panel y las hojas de instalar se cargan al usarlas (`lazy` e `import()`). Medirlo mostró una trampa: si un módulo lo usan dos bloques que se cargan aparte (o un bloque aparte y una pantalla), Metro lo pone en `__common`, que se baja siempre al abrir la app. Pasaba con `src/features/errores/api.ts`, que usaban el formulario y el panel: se dividió en `api.ts` (mandar) y `moderacion.ts` (listar y resolver). `hojaCompartir.web.ts` lo comparten el detalle y la hoja de instalar, y quedó en `__common` aunque se importe con `import()` (853 bytes sin comprimir). Al sumar un bloque aparte, conviene mirar qué entra en `__common` (el reporte `docs/reportes/2026-10-20-mejoras.md` explica cómo).

Lo que sí suma a la carga inicial, medido en ese reporte:
- los textos nuevos de `es-UY.ts`, que por regla viven ahí;
- el código de la hoja plegable, en la pantalla del mapa;
- el script y los enlaces de instalar en `index.html`.

## 2026-10-20 · Ubicaciones aproximadas en el mapa

La base guarda redondeados a 3 decimales (unos 100 m) los puntos que suelen ser una casa: donde se perdió un perdido (`publicar_animal`, migración 0010) y el "¿Dónde está ahora?" de un resguardo (`cambiar_estado_animal`, desde la 0013). Redondear protege el dato, pero un punto dibujado exacto sobre el mapa invita a leerlo como "la casa está acá". En el mapa en grande del recorrido, esos puntos se dibujan como una zona: un círculo translúcido de 110 m de radio en el color del tipo, con el número en el centro, y la tarjeta dice "Ubicación aproximada, unos 100 m a la redonda.".

- **Cuáles son:** se decide por el tipo de avistamiento (`perdido` y `resguardado`, `src/features/mapa/recorrido.ts`), no mirando si las coordenadas tienen 3 decimales: un punto exacto puede caer por casualidad en un valor redondo. Dos casos se dibujan como zona aunque en la base no estén redondeados: los resguardos de antes de la 0013 (19 de octubre de 2026) y un resguardo sin "¿Dónde está ahora?", que repite el último punto, ya público. Mostrar de más como zona no expone nada.
- **Por qué 110 m:** el redondeo deja el lugar real a menos de 56 m en latitud y 46 m en longitud (en Montevideo) del punto guardado, unos 72 m en diagonal. 110 m lo cubren con holgura y se leen como "unos 100 m". La zona mide eso en el mapa a cualquier zoom (`src/features/mapa/encuadre.ts`); de lejos no se achica más que 16 px de radio, para que se siga viendo y tocando.
- **El mini mapa del detalle sigue igual:** a 140 de alto y sin acercar, un punto ya no dice más que la zona.
- **Los demás avistamientos** ("Lo vio", "Lo encontró") se ven exactos: son de otras personas en la calle, como ya decía "La ubicación de un perdido se redondea en la base".

## 2026-10-20 · El mapa en grande, una pantalla en el bloque de MapLibre

El mapa en grande es una ruta (`/animal/<id>/mapa`) y no una hoja: Atrás vuelve al detalle sin tocar el historial del navegador, en web y en nativo. Si el caso no existe, está oculto o no carga, la pantalla manda al detalle, que ya sabe qué mostrar en cada caso; así no se comparte código entre las dos pantallas (iría a `__common`).

Para no sumar a la carga inicial, la lógica se divide según quién la usa. La pantalla ordena, numera y arma el GeoJSON (`src/features/mapa/recorrido.ts`) y el mapa recibe los datos listos. La vista inicial, el radio de la zona y el contraste de los números (`encuadre.ts`, `src/lib/contraste.ts`) los usa solo el mapa, que en web va en el bloque de MapLibre (`mapasWeb.ts`). Si un mismo módulo lo importaran la pantalla y el mapa, Metro lo pondría en `__common`. La vista inicial se calcula a mano (Web Mercator) en vez de con `fitBounds`, porque la cámara de MapLibre React Native no acepta zoom máximo al encuadrar: así web y nativo arrancan igual.

## 2026-10-20 · El servicio de visión pasa a Cloud Run

> Reemplazada el mismo día por "El reconocimiento pasa a la API de Claude": el servicio no llegó a desplegarse y queda en el repo como alternativa.

Hugging Face pasó a cobrar los Spaces con Docker, y el servicio nunca llegó a correr (`config_app.vision_url` vacío). Se evaluaron:
- **Hugging Face pago:** el plan más barato cuesta todos los meses, con o sin fotos.
- **Render y Fly.io:** Render gratis da 512 MB, menos de lo que usan los modelos; Fly.io ya no tiene plan gratis.
- **Edge Functions de Supabase:** tienen un límite de CPU por pedido que un modelo de visión no entra.
- **Google Cloud Run:** cobra por segundo de pedido (CPU solo mientras atiende) y apaga la instancia sin tráfico. Su capa gratuita (180 000 vCPU-segundos, 360 000 GiB-segundos y 2 millones de pedidos por mes) cubre miles de fotos (`services/vision/README.md`).

**Elegido Cloud Run, en `us-east5` (Columbus, Ohio).** Es de la capa Tier 1 (la gratuita se descuenta a precio Tier 1) y está al lado de Supabase (`us-east-2`, Ohio): cada foto se baja de Supabase y vuelve como embedding.

**Cambios en el servicio:**
- **Todo el trabajo dentro del pedido.** Cloud Run no da CPU fuera de los pedidos, así que no hay `BackgroundTasks` ni bucle interno. `/procesar` procesa la foto y responde al terminar; `/procesar-pendientes` vacía la cola con un tope de 90 s y dice cuántas quedan.
- **Modelos dentro de la imagen.** Se bajan en el build y se leen sin red al arrancar (`HF_HUB_OFFLINE`).
- **Puerto desde `PORT`.**
- **Configuración del servicio:** 2 vCPU, `min-instances 0`, `max-instances 1`, sin el refuerzo de CPU al arrancar (`--no-cpu-boost`, que se cobra) y en la primera generación del entorno, que arranca más rápido.

**Del lado de Supabase (migración 0017):** los avisos esperan lo que tarda en despertar: 60 s una foto y 150 s vaciar la cola, por el arranque en frío medido (`docs/reportes/2026-10-20-reconocimiento.md`). Si un aviso se corta, la foto sigue pendiente y la levanta el trabajo de cada 2 minutos.

## 2026-10-20 · Un trabajo de pg_cron despierta al servicio solo si hay fotos

El bucle interno del servicio revisaba la cola cada 5 minutos, pero en Cloud Run no puede correr: la instancia no tiene CPU entre pedidos y se apaga. Y el primer aviso a un servicio dormido se perdía (B31).

Ahora un trabajo de pg_cron (`vision-pendientes`, cada 2 minutos) llama a `despertar_vision()`:
- si no hay URL configurada o `cola_vision_pendientes` está vacía, no hace nada;
- si no, llama a `/procesar-pendientes`.

Así cubre los avisos perdidos y los reintentos con espera sin despertar al servicio cuando no hay nada: cada vuelta vacía es una consulta a la base y no consume nada en Google.

Otros detalles:
- **Por qué 2 minutos:** una foto cuyo aviso se perdió espera como mucho eso. Llamar más seguido no acelera nada, porque la vuelta anterior todavía puede estar trabajando (el servicio no superpone dos vueltas).
- **Historial de pg_cron:** anota cada corrida y no se limpia solo, así que otro trabajo borra las de más de 7 días.
- **"Procesar pendientes ahora":** el botón de moderación (`procesar_pendientes_vision`) hace la misma llamada.

## 2026-10-20 · Las claves del servicio, en Secret Manager

La clave secreta de Supabase y el secreto compartido podían ir como variables del servicio o en Secret Manager. Van en Secret Manager:
- Las variables se ven en la consola de Cloud Run y en `gcloud run services describe` para cualquiera con permiso de lectura en el proyecto, y quedan en cada revisión.
- En Secret Manager están cifradas, solo las lee la cuenta del servicio y cada lectura queda registrada.
- Entra en la capa gratuita: 6 versiones activas y 10 000 lecturas por mes. Cada arranque en frío lee 2.

Cómo lo maneja `desplegar.sh`:
- Al cambiar las claves, destruye las versiones viejas (las destruidas no cuentan).
- El servicio usa `latest`: cada despliegue arranca instancias nuevas, que leen la versión vigente.
- `SUPABASE_URL` no es secreta y va como variable común.

## 2026-10-20 · El servicio usa la clave secreta nueva de Supabase

Supabase depreca las claves legacy `anon` y `service_role` (JWT) a fines de 2026. El servicio de visión y `desplegar.sh` aceptan la clave secreta nueva (`sb_secret_…`) y la prefieren:
- **Dónde está:** Settings → API Keys → "Publishable and secret API keys" → Secret keys. Conviene una propia del servicio (por ejemplo `vision`): si se filtra, se borra sola, sin tocar las demás.
- **Cómo se manda:** no es un JWT. Según la documentación de Supabase ("Understanding API keys"), va solo en el header `apikey`, no como `Authorization: Bearer`; con ella el pedido tiene el rol `service_role`, que salta la RLS, igual que antes.
- **User-Agent:** Supabase rechaza (401) una clave secreta en un pedido que parece de un navegador. El servicio manda siempre `User-Agent: encontrados-vision`.
- **La legacy sigue andando** mientras exista: va en `apikey` y como `Authorization: Bearer`. El servicio la toma de `SUPABASE_SERVICE_ROLE_KEY` si no está `SUPABASE_SECRET_KEY`; el script la acepta con un aviso. Las dos formas tienen su prueba (`services/vision/tests/test_db.py`).
- **En Secret Manager** se guarda con el nombre `encontrados-supabase-secret-key` y llega al servicio como `SUPABASE_SECRET_KEY`.
- **La app no cambia:** usa la `anon`, que también se depreca. Pasarla a la publishable (`sb_publishable_…`) queda pendiente: es otra tarea, con su variable en Vercel y la vista previa del link.

## 2026-10-20 · Umbral de similitud: 0,80 hasta medirlo con fotos reales

> Vale solo para el servicio de embeddings, que no se usa desde la 0018. El reconocimiento con IA usa `umbral_ia` (ver "El reconocimiento pasa a la API de Claude").

`config_app.umbral_similitud` queda en 0,80. Para calibrarlo, `services/vision/evaluar.py` toma fotos de animales conocidos y calcula, por umbral:
- cuántos pares del mismo animal detecta y cuántos pares falsos aparecen;
- como la app, qué parte de las fotos encuentra a su animal y cuántas coincidencias falsas tendría cada foto con 20 animales de la especie cerca.

Recomienda el umbral que más encuentra sin pasar de 0,2 falsas por foto.

**No se pudo correr al hacer el cambio:** el entorno de trabajo no llega a Hugging Face (los modelos) ni a los conjuntos públicos. Los conjuntos sugeridos, con licencia CC BY 4.0, que permite evaluar:
- **Perros: MPDD** (192 perros, unas 9 fotos de cuerpo entero por perro, en distintas posturas).
- **Gatos: Cat Individual Images** (518 gatos; fotos centradas en la cara).

**Por qué no bajarlo a ciegas:** una coincidencia falsa le llega como aviso a una familia que busca a su animal. Que una persona confirme cada una no le quita peso a ese aviso. Además, el radio (15 km), la ventana (60 días) y la especie ya acotan los candidatos.

**Limitaciones del embedding** (DINOv2 small, el vector de toda la imagen recortada):
- **Pose y ángulo:** el mismo perro de frente y de costado se parece menos que dos perros distintos de la misma raza en la misma pose.
- **Fondo:** el recorte lo saca casi todo. Si el detector no encuentra al animal se usa la foto entera, y dos animales fotografiados en el mismo lugar se parecen más.
- **Animales muy parecidos:** labradores negros, gatos blancos y mestizos atigrados se distinguen por marcas chicas que el vector casi no ve. Ahí van a aparecer coincidencias falsas con cualquier umbral que encuentre algo.
- **Fotos difíciles:** de noche, movidas, de lejos o con el animal tapado.

## 2026-10-20 · El reconocimiento pasa a la API de Claude

El servicio de embeddings en Cloud Run (entradas anteriores) no llegó a desplegarse: pedía un proyecto de Google Cloud con facturación y una imagen de casi 1 GB, y el umbral no se pudo calibrar con fotos reales. En su lugar, Claude mira las fotos: primero describe cada foto nueva y después la compara con pocos candidatos que elige la base, y dice por qué se parecen. La familia sigue confirmando o rechazando: nada se une solo.

**Por qué:**
- **Explica:** la familia ve "Mismo collar rojo y mancha blanca en el pecho" en vez de "se parece en un 86 %", y puede juzgar mirando eso en las fotos.
- **Ve lo que el embedding no veía:** marcas, collar, orejas y cola, con poses, fondos y luces distintas. El vector de toda la imagen confundía dos animales de la misma raza en la misma pose (las limitaciones de la entrada del umbral).
- **Sin infraestructura nueva:** corre en una Edge Function de Supabase, que ya se usa. El trabajo pesado lo hace la API, así que el límite de CPU de las Edge Functions (2 s por pedido, sin contar la espera) no molesta: la función casi solo espera respuestas.
- **Costo chico y con topes:** se paga por llamada. Con Claude Haiku 5.5, unos US$0,0013 por foto con 10 candidatos (estimación en `docs/reportes/2026-10-20-reconocimiento-ia.md`). Hay interruptor, tope de llamadas por día y pausa automática sin crédito.

**Lo que se resigna:** cuesta plata por foto (la capa gratuita de Cloud Run no), depende de la API de Anthropic y de tener crédito, y el modelo no es determinista: la misma foto puede dar una confianza un poco distinta.

**Cómo:**
- **Modelo:** `config_app.ia_modelo`, por defecto `claude-haiku-5-5`, el más barato. Si la evaluación (`scripts/evaluar-ia.ts`) muestra que no alcanza, se cambia ahí sin desplegar nada; los precios de los modelos conocidos están en `claude.ts` para el costo estimado.
- **Dos pasos:** describir y después comparar. La descripción se hace una vez por foto (un reintento no la repite) y sirve para dos cosas: descartar en SQL los candidatos con colores o tamaños claramente incompatibles, y darle contexto a la comparación.
- **Candidatos en SQL** (`candidatos_ia`), con las mismas reglas que `guardar_embedding`: misma especie, abiertos y visibles, a menos de 15 km, ventana de 60 días, perdido con encontrado o encontrado con encontrado, nunca perdido con perdido ni un encontrado visto más de un día antes de la pérdida. Del más cercano al más lejano, hasta `max_candidatos` (10; nunca más de 20 fotos por llamada).
- **Cada par de casos se compara una vez** (`comparaciones_ia`, par ordenado). Una foto nueva de un caso ya comparado con otro no repite la comparación: ahorra llamadas, y lo que importa es el par de casos. Los pares que ya tienen coincidencia (también las rechazadas) tampoco se comparan.
- **"Claramente incompatibles":** los colores se ordenan de claro a oscuro (blanco, dorado y naranja, gris, marrón, negro) y se descarta el par solo si ningún color de un lado (principal o secundario) queda a menos de 3 pasos de alguno del otro: negro con blanco, dorado o naranja; blanco con marrón. Los tamaños, solo chico con grande. Sin datos de un lado, no se descarta: la luz y el ángulo engañan, y descartar de más es perder un reencuentro.
- **Salida estructurada:** cada paso es una herramienta con esquema JSON estricto (`strict`), con `tool_choice: auto` porque Claude Opus 5.5 y Sonnet 5.5 no aceptan forzar la herramienta y el modelo es configurable. Cada respuesta se valida en la función (largos, rangos, un resultado por candidato): si no valida, cuenta como error y la cola la reintenta.
- **Esfuerzo:** `low` para describir y `medium` para comparar.
- **Fotos por URL:** la miniatura de 320 de la Fase 8 (unos 140 tokens por imagen). Las de otros sitios las baja la función (ver "Las fotos de otros sitios las baja la función"). El nombre de la miniatura se arma en `src/lib/imagenes.ts`; la función, que no puede importar de `src/`, tiene una copia que `__tests__/imagenes.test.ts` compara con la original.
- **Lo que viaja:** solo las fotos y los datos del animal (tipo, tamaño, color y collar declarados, y lo que se vio en las fotos). Nunca nombres, contactos, mensajes ni la descripción libre. Las instrucciones le piden a Claude que ignore cualquier pedido escrito en una foto o en los datos.
- **Seguridad de la función:** `verify_jwt = false`, porque la llama Postgres, que no tiene un JWT de usuario; la protege `X-Vision-Secret`, que la función compara con `config_app.vision_secret` (lo lee de la base, así no hay que cargarlo en dos lugares). Para escribir, la clave secreta que Supabase pone en su entorno; `ANTHROPIC_API_KEY`, como secreto de la función.
- **Errores de la API:** 429, 529 y cualquier otro marcan la foto con error y la cola la reintenta con espera creciente. Sin crédito (402), además, se pausa todo (`ia_pausa`) hasta que un moderador toca **Reactivar**: si no, cada foto gastaría sus 8 intentos en minutos.
- **Topes:** `ia_activa` apaga los avisos, el trabajo de cada 2 minutos y la función. `ia_tope_diario` (300) cuenta las llamadas del día en hora de Montevideo: cada llamada se reserva antes en la base, con un candado, así dos fotos a la vez no lo pasan. Al llegar, las fotos esperan al día siguiente sin gastar intentos.
- **Registro:** cada llamada queda en `llamadas_ia` con tokens, costo estimado, modelo y resultado. Moderación ve las llamadas de hoy, el costo del mes y los errores.
- **El servicio de embeddings queda desactivado:** `guardar_embedding` no se puede llamar desde la API (se le sacó el permiso a `service_role`), pero sus datos quedan (`avistamientos.embedding` y las coincidencias con `origen = 'embedding'`, que la app sigue mostrando con el porcentaje). Para volver a usarlo: `grant execute on function public.guardar_embedding(uuid, extensions.vector, jsonb) to service_role;`, desplegar `services/vision` y poner su URL en `vision_url`.
- **Privacidad:** la política (borrador) dice que las fotos las analiza Anthropic y qué se le manda. Cambió el texto, así que subió la versión de los términos (`2026-10-20`) y todos los vuelven a aceptar.

## 2026-10-20 · Las fotos de otros sitios las baja la función

En la primera prueba real del reconocimiento (`docs/reportes/2026-10-20-cierre-reconocimiento-ia.md`), ninguna de las 5 fotos de la cola se procesó. Todas eran datos de demo, con una URL de otro sitio en vez de una ruta del bucket:
- **placedog.net** sirve sus fotos con el tipo `image/jpg`, que no existe (es `image/jpeg`), y la API las rechazó con `invalid_request_error`.
- **cataas.com** no respondió bien a la comprobación previa con HEAD, así que sus fotos quedaron como "foto no disponible".

Además, `llamadas_ia.detalle` guardaba solo el tipo de error, así que no se pudo leer el porqué.

**Cambios:**
- **Las fotos de otros sitios las baja la función** y las manda dentro del pedido (base64), con el tipo que dicen sus bytes: JPEG, PNG, WebP o GIF; cualquier otra cosa es "foto no disponible". Tope de 5 MB (lo que acepta la API por imagen) y de 10 s por foto, todo junto (conectar y leer); las de los candidatos se bajan a la vez. Por pedido van hasta 20 MB de fotos bajadas (la API acepta 32 MB); los candidatos que no entran quedan afuera, como uno sin foto.
- **Las fotos del bucket siguen yendo por URL,** siempre la miniatura. Ya no se comprueba nada antes: toda foto se sube con su miniatura y no se publica si alguna de las dos falla (`comprimirYSubir`). Si una URL igual no sirve, la API lo dice y queda en el registro.
- **Sin la comprobación HEAD:** fallaba con sitios que no la contestan bien y, para el bucket, no hace falta.
- **El texto del error de la API** queda en `llamadas_ia.detalle` junto al tipo y al id del pedido: hasta 300 caracteres (migración 0019) y sin claves, URLs, emails, ids ni números largos (`limpiarDetalle`). La cola sigue guardando solo el código.

**Lo que se resigna:** las fotos de demo pasan por la función (unos 40 KB cada una) y ocupan más tokens que una miniatura de 320 (son de 640 × 480). Solo existen en los datos cargados por SQL: la app nunca guarda una URL de otro sitio.

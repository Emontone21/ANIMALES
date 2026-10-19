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

La app siempre ofreció escribirle a quien publicó el caso o a quien lo resguarda, pero `abrir_conversacion` aceptaba cualquier usuario: como los perfiles son públicos, cualquiera con cuenta podía escribirle a todos (y mandarles un aviso con el texto). Desde la migración 0013 la otra persona tiene que haber publicado el caso (o un reporte unido a él) o haberlo resguardado alguna vez. Una conversación que ya existe se puede retomar, así quien publicó le contesta a quien le escribió primero. Se descartó sumar a quienes avisaron que lo vieron: la app no lo ofrece y abriría de nuevo la puerta a escribirle a cualquiera que aparezca en un historial.

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

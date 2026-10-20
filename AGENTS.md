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
- **Perdidos y encontrados** conviven en `animales` (`tipo_reporte`). Un perdido solo lo cierra o reabre su familia, y nunca se sugiere con otro perdido. Las RPC de publicación y avistamiento solo aceptan fotos subidas a la carpeta del usuario en el bucket `fotos`. Resguardar un perdido pide una foto actual, y su contacto (`contactos_resguardo`) lo ven solo la familia y quien lo resguarda.
- **Términos:** publicar, avisar que lo viste, cambiar el estado, escribir y denunciar exigen la versión vigente aceptada (`config_app.terminos_version`), en la base y en la app. Si cambiás los textos de `t.legal`, subí `VERSION_TERMINOS` (`src/features/legal/terminos.ts`) y `terminos_version` con una migración.
- **Cuentas borradas:** `animales.creado_por`, `avistamientos.usuario_id` y `cambios_estado.usuario_id` pueden ser null (contenido que quedó publicado sin autor; nunca un perdido, que se borra con la cuenta). Compará usuarios con `is distinct from`, nunca con `<>` ni `not in`: con null, la validación se saltea. Toda tabla nueva que apunte a `perfiles` decide qué pasa al borrar la cuenta y, si guarda contenido publicado, se suma a `limpiar_cuenta`. Nunca se borran filas de `storage.objects` por SQL: las fotos se borran con la API de Storage.
- **Bloqueos:** quien está bloqueado no abre conversaciones ni manda mensajes, y quien bloquea no recibe sus avisos (`notificar` recibe el actor, también en las coincidencias: quien publicó el otro reporte). No le avisamos a quien bloquean.
- **Mensajes:** solo se abre una conversación con quien publicó el caso (o un reporte unido a él) o con quien lo resguardó; además, quien publicó el caso o un reporte unido a él le puede escribir a quien avisó que lo vio ("Escribirle" en el Historial, `aQuienesLoVieron`). Lo valida `abrir_conversacion`. Una conversación que ya existe se puede retomar; sobre un caso oculto no se abren nuevas.
- **Casos ocultos:** un caso oculto por moderación lo ven solo quien lo publicó y los moderadores, con todo lo que cuelga de él (la política de lectura de `animales` y las que preguntan si se ve el caso). Toda tabla o vista nueva que cuelgue de un caso sigue esa regla. Para el resto se muestra igual que un caso inexistente ("Esta publicación no está disponible."); las conversaciones que había siguen, sin los datos del caso (`animal_disponible`).
- **Errores en pantalla:** nunca el `message` de un error tal cual (llega en inglés de la red, PostgREST o Storage). Usá `mensajeDeError` (`src/lib/errores.ts`); los errores propios con texto de `es-UY.ts` son `ErrorVisible`.
- **Ubicaciones:** lo que suele ser una casa se guarda redondeado a 3 decimales en la base: el punto de un perdido y el "¿Dónde está ahora?" de un resguardo. En web la posición se pide directo al navegador (`obtenerPosicionActual`), con antigüedad máxima de 10 s.
- **Fotos y miniaturas:** toda foto se sube con `comprimirYSubir` (`src/lib/fotos.ts`), que sube también su miniatura de 320. El nombre de la miniatura se arma solo en `src/lib/imagenes.ts`. Lo que se muestra chico (tarjetas, listas, avatares, marcadores) usa `FotoMiniatura`, que cae a la original si no hay miniatura. Para borrar fotos, la base devuelve la lista (con las variantes, que comparten la ruta hasta el primer punto) y la app las borra con `borrarFotos`.
- **Gestionar casos:** editar y borrar un reporte es solo de quien lo publicó (`reporte_propio`), nunca de un reporte unido a otro. Borrar un caso pasa siempre por `borrar_casos`, la misma función de `limpiar_cuenta`: no escribas otra lógica de borrado.
- **Servidor propio:** la única pieza es `api/vista-previa.ts`, una función de Vercel sin dependencias que solo lee con la clave anon y solo recibe bots de vista previa (`vercel.json`). Nunca pone datos personales (contacto, quién publicó, ubicación, descripción libre). Lo que importa de `src/` (textos, `imagenes.ts`, `compartir.ts`, `env.ts`) usa rutas relativas y no puede importar nada de React ni de Expo. `.vercelignore` deja afuera `services/`: el preset de Vercel es Other.
- **Licencias:** solo modelos y librerías con licencias permisivas (Apache 2.0, MIT, BSD). Nada de AGPL (por ejemplo YOLOv8). Excepción aprobada por el dueño: fuentes tipográficas bajo SIL OFL 1.1 (hoy Fredoka y Figtree, ver `docs/DECISIONES.md`).
- **Íconos:** `import Ionicons from '@expo/vector-icons/Ionicons'`, nunca desde `@expo/vector-icons`: el índice arrastra las 17 familias de íconos y sus fuentes al build web.
- **Dependencias:** instalar con `npx expo install <paquete>` para respetar la versión del SDK. Módulos nativos nuevos exigen rebuild (`npx expo run:android`).
- **Nada local:** el backend es Supabase en la nube y la app se prueba en el navegador (`npx expo start --web`) o en Vercel. No propongas Docker ni builds nativos salvo que lo pidan.
- **Compartir:** los links son `<sitio>/animal/<id>` con `linkDelCaso` (`EXPO_PUBLIC_SITE_URL`). La hoja del sistema está en `src/lib/hojaCompartir.ts` y su `.web.ts`: lo que toque compartir o el portapapeles tiene versión web.
- **Web y nativo:** todo componente que use mapas tiene versión `.web.tsx` (maplibre-gl) y `.tsx` (MapLibre React Native) con el mismo contrato en `src/components/mapa/tipos.ts`. Lo que toque cámara, archivos o auth debe funcionar en web (`Platform.OS === 'web'`).
- **Hojas y Atrás:** toda hoja o modal nuevo usa `Hoja`, `MenuOpciones` o, si es otro `Modal`, `useCerrarConAtras(visible, onCerrar)`: en web, Atrás la cierra. `src/lib/historialHojas.ts` envuelve `pushState`, `replaceState` y `go` de `window.history` y depende de cómo los usa Expo Router: al actualizar Expo o Expo Router, volvé a recorrer los 8 casos de "Atrás con una hoja abierta" en `docs/PRUEBAS-MANUALES.md` y corré sus pruebas (`__tests__/historialHojas.test.ts`).
- **Antes de dar algo por terminado:** `npm run typecheck`, `npm run lint`, `npm run test` y `npx expo export -p web` sin errores. Si tocás la base, las pruebas de `supabase/tests/` tienen que seguir pasando; las reglas nuevas suman pruebas ahí.
- **Pruebas de la app:** `npm run test` (jest-expo) cubre la lógica sin pantallas, en `__tests__/`. Lo que calcula la app (fechas, filtros, textos, rutas de fotos, permisos, validaciones) va en funciones puras, con su prueba; una regla nueva suma su prueba ahí. Las pantallas se prueban a mano con `docs/PRUEBAS-MANUALES.md`.

## Expo cambia seguido

Las APIs de Expo cambian entre SDKs. Antes de escribir código que use un módulo de Expo, leé la versión del paquete `expo` en `package.json` y consultá `https://docs.expo.dev/versions/v<major>.0.0/` o el índice `https://docs.expo.dev/llms.txt`. No respondas de memoria. MapLibre React Native v11 también cambió su API (componentes `Map`, `Camera`, `GeoJSONSource`, `Layer` con `paint`/`layout`); los tipos en `node_modules/@maplibre/maplibre-react-native/src` son la referencia.

## Comandos

```bash
npx expo start --web        # servidor de desarrollo web (http://localhost:8081)
npx expo export -p web      # build estático para Vercel (dist/)
npm run typecheck           # tsc --noEmit
npm run lint                # eslint + prettier
npm run test                # jest-expo: lógica de la app y la vista previa (__tests__/)
npx supabase db push        # subir migraciones al proyecto en la nube (tras supabase link)
```

## Estructura

- `src/app/`: rutas de Expo Router. Solo pantallas y layouts; la lógica va afuera.
- `src/components/ui/`: componentes genéricos reutilizables. `mapa/`, `reportes/`, `auth/`, `legal/`: componentes por área.
- `src/features/<área>/`: acceso a datos (`api.ts`), hooks, acciones y reglas puras (`permisos.ts`, `validaciones.ts`). Único lugar que consulta la base; Storage se usa desde `src/lib/fotos.ts`.
- `src/lib/`: utilidades sin React (supabase, imágenes y miniaturas, fotos, compartir, ubicación, fechas, errores, env).
- `src/constants/tema.ts`: paletas claro y oscuro, espacios, radios, fuentes y escala tipográfica. `src/hooks/`: `useTema`, `useEstilos`, `useDisposicion` (compacto, medio, amplio) y `useElegirFoto`.
- `supabase/`: configuración, migraciones (0001–0014), pruebas SQL por fase (`tests/`), seed. `services/vision/`: microservicio Python de reconocimiento.
- `api/`: función de Vercel de la vista previa del link (Open Graph).
- `__tests__/`: pruebas de jest (`npm run test`). `docs/PRUEBAS-MANUALES.md`: la lista para probar a mano en celulares y computadora.
- `public/`: archivos estáticos de la web. `vercel.json`: despliegue y qué pedidos van a `api/`. `.vercelignore`: lo que Vercel no recibe.

## Fases

1. Proyecto base, auth, mapa, publicación con foto. **(hecha)**
2. Interacciones: "lo vi acá también", estados, historial, recorrido, denuncias. **(hecha)**
3. Reconocimiento: cola, servicio de visión, pgvector, coincidencias con confirmar/rechazar. **(hecha)**
4. Notificaciones, mensajería, moderación. **(hecha)**
5. Permisos y correcciones: casos solo por RPC, UPDATE e INSERT limitados por columna (0007 y 0008), pruebas SQL de permisos. **(hecha)**
6. Reportes de perdidos: la familia publica a su animal (`animales.tipo_reporte`, `nombre`, `contacto_familia`), chips Todos · Perdidos · Encontrados, reglas de quién cierra un caso y quién confirma coincidencias, perdido siempre como principal. **(hecha)**
7. Cuenta y protección de usuarios: recuperar la contraseña, editar el perfil, términos y privacidad (borrador), borrar la cuenta con anonimato, bloqueos, denuncias de cuentas nuevas y resguardo de perdidos con foto y contacto privado. **(hecha)**
8. Gestión de casos y compartir: miniaturas (foto en todos los marcadores), editar y borrar un reporte propio, compartir con la hoja del sistema o WhatsApp, vista previa del link para bots (función de Vercel) y lista de casos ("Ver lista"). **(hecha)**
9. Revisión integral, parte 1: auditoría, correcciones (migración 0013), pruebas de la app con jest-expo y lista de pruebas manuales. **(hecha)**
   Parte 2: casos ocultos por moderación que dejan de verse y la familia que le escribe a quien lo vio (migración 0014), Atrás cierra la hoja en web, `bordeCampo` y arreglos chicos (íconos, caché, accesibilidad). **(hecha)**

Pendiente de configuración externa (lo hace el dueño del proyecto): proyecto Supabase con migraciones aplicadas, proyecto Vercel con variables, Space de Hugging Face para el servicio de visión. Ver README.

# Spot · Plan de rediseño visual

Actualizado: 21 de octubre de 2026.

Este documento es la fuente de verdad del aspecto de la app. Resume la dirección elegida, "Calma oliva", y todo lo que hace falta para aplicarla en cada pantalla, en celulares de cualquier tamaño y en computadoras, en modo claro y oscuro.

## 0. Cómo usar este documento

- Guardalo en el repo como `docs/DISENO.md`.
- Agregá esta regla en `AGENTS.md`: "Las decisiones visuales están en `docs/DISENO.md`. Todo componente nuevo o modificado las respeta. Ningún color se escribe fuera de `src/constants/tema.ts`."
- Registrá en `docs/DECISIONES.md` cuatro decisiones: la paleta oliva y negro, las fuentes Fredoka y Figtree con su licencia (sección 3), el modo oscuro con preferencia del usuario y los tres tamaños de pantalla (sección 8).
- El rediseño **no cambia funcionalidad ni datos**. No hay migraciones ni cambios en los `api.ts`. Toda acción que existe hoy tiene que seguir disponible (la lista está en la sección 13).
- Se aplica la forma de trabajo de siempre:
  - verificar antes de cambiar;
  - correr `npm run typecheck`, `npm run lint` y `npx expo export -p web`;
  - hacer un solo commit, sin push;
  - escribir el reporte en `docs/reportes/AAAA-MM-DD-rediseno.md`.

## 1. Idea general

Quien perdió un animal está angustiado y apurado. La app tiene que sentirse tranquila, clara y rápida.

- **Minimalista.** Verde oliva y negro sobre blancos apenas cálidos.
- **Un solo color de alerta.** El naranja se reserva para los perdidos.
- **El mapa es el protagonista** de la pantalla principal.
- **Las fotos aportan el color.** Las fotos de los animales son lo único con color fuerte.
- **Formas suaves.** Bordes redondeados, sombras solo en lo que flota sobre el mapa.
- **Nada de mayúsculas sostenidas ni emojis.** Los textos van en oraciones cortas, con voseo. Única excepción: la etiqueta "SE PERDIÓ" o "ENCONTRADO" de la historia para compartir (6.18), que funciona como un cartel.

Significado de los colores:

- **Negro:** texto. Además destaca un solo elemento por pantalla, como el filtro activo o el botón Publicar.
- **Oliva:** la acción principal y todo lo que está a salvo (encontrado, resguardado).
- **Naranja:** solo perdidos.

## 2. Paleta

### 2.1 Colores de la interfaz

Los nombres son las claves del objeto de paleta en `tema.ts`. Las dos paletas tienen exactamente las mismas claves.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `fondo` | `#F6F6F2` | `#121410` | Fondo de pantallas |
| `superficie` | `#FFFFFF` | `#1B1D18` | Tarjetas, hojas, barras, campos |
| `superficieSuave` | `#EEEFE8` | `#24271F` | Chips de datos, avisos, avatar |
| `borde` | `#E2E3DA` | `#2E3128` | Líneas, contornos, separadores, línea de tiempo |
| `bordeCampo` | `#8A8D81` | `#686C5F` | Contorno de campos de texto y del recuadro de la foto (3:1, ver 2.4) |
| `texto` | `#151613` | `#EDEEE6` | Texto principal |
| `textoCuerpo` | `#383A33` | `#CFD2C6` | Párrafos largos y notas |
| `textoSecundario` | `#5C5F55` | `#A3A797` | Horarios, distancias, ayudas, íconos inactivos |
| `primario` | `#556B2F` | `#8FA357` | Botón principal, pestaña activa, enlaces, encontrados |
| `primarioPresionado` | `#46582A` | `#7D9049` | Botón principal mientras se toca o con hover |
| `textoSobrePrimario` | `#FFFFFF` | `#121410` | Texto e íconos sobre `primario` |
| `primarioSuave` | `#E7EBDA` | `#2C3320` | Fondo de etiqueta encontrado, cápsula de pestaña activa |
| `textoPrimarioSuave` | `#3E4E1F` | `#C3D293` | Texto sobre `primarioSuave` |
| `inverso` | `#151613` | `#EDEEE6` | Relleno de lo destacado: filtro activo, botón Publicar, clusters |
| `textoInverso` | `#FFFFFF` | `#121410` | Texto sobre `inverso` |
| `perdido` | `#C46A1A` | `#F5B068` | Anillo de marcador, puntos y halo de perdidos |
| `perdidoSuave` | `#F7E6D2` | `#3A2816` | Fondo de la etiqueta Perdido |
| `textoPerdido` | `#8F4A0E` | `#F0B77E` | Texto de la etiqueta Perdido |
| `coincidenciaFondo` | `#EFF2E4` | `#20261A` | Bloque de posibles coincidencias |
| `avisoFondo` | `#F3F4EE` | `#1B1D18` | Aviso contra estafas |
| `puntoInactivo` | `#C9CBBF` | `#4A4E42` | Puntos anteriores de la línea de tiempo |
| `peligro` | `#B3261E` | `#F2B8B5` | Errores, Denunciar, publicación oculta |
| `peligroSuave` | `#F9E3E1` | `#3B1E1C` | Fondo de mensajes de error |
| `sombra` | `rgba(21,22,19,0.10)` | `rgba(0,0,0,0.40)` | Sombra de lo que flota sobre el mapa |

Equivalencias semánticas, para no duplicar valores:

- `encontrado = primario`
- `encontradoSuave = primarioSuave`
- `textoEncontrado = textoPrimarioSuave`
- `exito = primario`

### 2.2 Colores del mapa

| Token | Claro | Oscuro |
| --- | --- | --- |
| `mapaTierra` | `#EFEFE8` | `#1A1C17` |
| `mapaCalle` | `#FFFFFF` | `#272A22` |
| `mapaAvenida` | `#FFFFFF` (más ancha) | `#2E3128` |
| `mapaParque` | `#DCE2C8` | `#232A19` |
| `mapaAgua` | `#D5DCDC` | `#12181A` |
| `mapaCosta` | `#FFFFFF` | `#2E3128` |

### 2.3 Estado de cada caso

Las etiquetas son cápsulas con fondo suave y texto oscuro del mismo tono. El color del anillo del marcador sale de la misma tabla.

| Estado o tipo | Fondo de etiqueta | Texto | Anillo del marcador |
| --- | --- | --- | --- |
| Perdido (Fase 6) | `perdidoSuave` | `textoPerdido` | `perdido` + halo |
| Avistado (encontrado) | `primarioSuave` | `textoPrimarioSuave` | `primario` |
| Resguardado | `primarioSuave` | `textoPrimarioSuave` | `primario` |
| Reunido | `superficieSuave` | `textoSecundario` | `textoSecundario`, marcador al 45 % de opacidad |
| Vinculado | `superficieSuave` | `textoSecundario` | No aparece en el mapa |

**La especie deja de tener color.** `ColorEspecie` (naranja, violeta y azul) y `ColorEstado` se eliminan. La especie se muestra como texto en un chip de datos ("Perro", "Gato").

### 2.4 Contraste verificado

Todo texto supera 4,5:1.

| Par | Claro | Oscuro |
| --- | --- | --- |
| Texto sobre superficie | 18,2:1 | 14,5:1 |
| Secundario sobre superficie | 6,5:1 | 6,9:1 |
| Botón primario | 5,9:1 | 6,7:1 |
| Etiqueta perdido | 5,5:1 | 7,9:1 |
| Etiqueta encontrado | 7,5:1 | 8,1:1 |
| Etiqueta de la historia, perdido (`textoPerdido` sobre `superficie`) | 6,7:1 | 9,5:1 |
| Etiqueta de la historia, encontrado (`textoEncontrado` sobre `superficie`) | 9,1:1 | 10,5:1 |
| Texto de la historia sobre su fondo (6.18) | 5,5:1 o más | 5,5:1 o más |
| Contador y tarjeta de reencuentros (`textoPrimarioSuave` sobre `primarioSuave`, 6.7 y 6.19) | 7,5:1 | 8,1:1 |
| "Ver historias" (`primario` sobre `primarioSuave`, 6.7) | 4,9:1 | 4,7:1 |

Lo que no es texto pero hay que ver para usarlo (el contorno de un campo) supera 3:1 contra lo que lo rodea:

| Par | Claro | Oscuro |
| --- | --- | --- |
| `bordeCampo` sobre superficie | 3,4:1 | 3,2:1 |
| `bordeCampo` sobre fondo | 3,1:1 | 3,4:1 |

`borde` (1,3:1) queda para líneas y separadores, que no hace falta distinguir.

Cualquier combinación nueva de colores se verifica antes de usarla.

**Perdido y encontrado no se distinguen solo por el color.** El oliva y el naranja pueden confundirse con daltonismo, así que el marcador de un perdido siempre lleva halo.

## 3. Tipografía

| Familia | Rol | Pesos |
| --- | --- | --- |
| Fredoka | Títulos y nombres de animales | 600 |
| Figtree | Todo el resto | 400, 600 y 700 |

**Instalación.** Con `npx expo install @expo-google-fonts/fredoka @expo-google-fonts/figtree`.

- **Nativo:** se cargan con `useFonts` (`src/hooks/useFuentes.ts`), manteniendo la pantalla de carga (`expo-splash-screen`) hasta que estén listas. Si fallan, se usa la fuente del sistema.
- **Web:** nada las espera. `public/index.html` las declara con `@font-face` y `font-display: swap` (los archivos los copia `scripts/copiar-a-public.js` a `public/fuentes/`). Arrancan apagadas y la app las activa después de las fotos que se ven al abrir (`src/lib/fuentesWeb.ts`). Hasta entonces el texto usa la pila del sistema de `Fuentes` (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`) y después cambia solo. Cada `@font-face` declara su peso (600, 400, 600 y 700), así el navegador no engrosa de más una fuente que ya es seminegrita.

**Licencia.** Los paquetes son MIT (código) y SIL OFL 1.1 (fuentes). OFL permite incluir las fuentes en apps, pero no está en la lista de licencias de `AGENTS.md`. El dueño aprobó esta excepción para fuentes tipográficas: anotala en `docs/DECISIONES.md` y en la regla de licencias de `AGENTS.md`.

**Detalle técnico importante.** En Android, `fontWeight` no elige el peso de una fuente cargada. Cada peso es una familia aparte (por ejemplo `Figtree_700Bold`). Definí en `tema.ts` un objeto `Fuentes` que mapee cada variante a su `fontFamily`, y no dependas de `fontWeight`.

### Escala

| Variante | Fuente | Tamaño / interlineado | Uso |
| --- | --- | --- | --- |
| `contador` | Fredoka 600 | 56 / 60 | El número del muro de reencuentros (6.19) |
| `display` | Fredoka 600 | 40 / 42 | Nombre del animal en el detalle |
| `titulo` | Fredoka 600 | 28 / 32 | Título de pantalla (Publicar, Actividad, Perfil) |
| `subtitulo` | Fredoka 600 | 22 / 28 | Secciones: Cerca tuyo, Historial |
| `tituloTarjeta` | Fredoka 600 | 19 / 24 | Nombre en tarjetas y bloque de coincidencias |
| `cuerpo` | Figtree 400 | 16 / 25 | Párrafos y descripciones |
| `cuerpoFuerte` | Figtree 700 | 17 / 22 | Dato destacado, como "Hoy a las 9:40" |
| `etiquetaCampo` | Figtree 600 | 14 / 20 | Etiquetas de formularios y chips |
| `secundario` | Figtree 400 | 14 / 20 | Distancia y tiempo |
| `pequeno` | Figtree 400 | 13 / 18 | Fechas de la línea de tiempo |
| `etiqueta` | Figtree 700 | 13 / 16 | Cápsulas de estado |
| `boton` | Figtree 700 | 16 / 20 | Botones |
| `pestania` | Figtree 600 (activa 700) | 12 / 16 | Barra de pestañas |

**Reglas de texto:**

- Nada por debajo de 12.
- Oraciones en minúscula inicial normal, sin mayúsculas sostenidas.
- Todo texto visible vive en `src/i18n/es-UY.ts`, con voseo.
- La app no nombra la marca de la IA: dice "inteligencia artificial" o "IA" (y "el servicio de IA" para la cuenta, el crédito y los errores). Solo la política de privacidad nombra a Anthropic, como proveedor, igual que a Supabase y Vercel. Lo comprueba `__tests__/reconocimiento.test.ts`.

## 4. Forma, espacio y elevación

**Espacios.** Escala de 4, 8, 12, 16, 20, 24, 32 y 48. El margen lateral es de 20 en la pantalla del mapa y de 24 en el detalle y los formularios.

**Radios:**

| Radio | Valor | Uso |
| --- | --- | --- |
| `s` | 10 | Miniaturas chicas |
| `m` | 16 | Mapas dentro de tarjetas, campos de texto |
| `l` | 20 | Fotos en tarjetas, avisos |
| `xl` | 24 | Tarjetas y bloques |
| `hoja` | 28 | Hoja inferior |
| `cabecera` | 36 | Esquinas inferiores de la foto del detalle |
| `redondo` | 999 | Botones, chips, etiquetas, buscador, botones de ícono |

**Sombras.** Solo para lo que flota sobre el mapa o la foto: chips flotantes, botones redondos, hoja inferior y marcadores.

- Claro: `0 6 18 sombra`.
- Oscuro: `0 6 18 sombra`, más un borde de 1 px en `borde`, porque la sombra casi no se ve sobre fondo oscuro.
- Las tarjetas sobre una superficie no llevan sombra. Se separan con un borde de 1 px o con un fondo tintado.

**Áreas táctiles.** Mínimo 44 × 44 en todo lo que se toca. Los botones principales miden 54 de alto.

## 5. Íconos

Se usa Ionicons, que ya está instalado, siempre en variante de contorno (`-outline`), de 20 a 22 px. Antes de usar cada nombre, verificá que exista en la versión instalada.

| Uso | Ícono |
| --- | --- |
| Mapa | `map-outline` |
| Publicar | `add`, dentro de una cápsula `inverso` |
| Actividad | `notifications-outline` |
| Perfil | `person-outline` |
| Filtros | `options-outline` |
| Mi ubicación | `locate-outline` |
| Volver | `chevron-back` |
| Seguir | `notifications-outline`; siguiendo: `notifications`, en `primario` |
| Más opciones | `ellipsis-horizontal` |
| Lo vi | `eye-outline` |
| Escribir | `chatbubble-outline` |
| Aviso contra estafas | `shield-outline` |
| Foto (publicar) | `camera-outline` |
| Instalar la app | `download-outline` |
| Reportar un error, y su aviso en Actividad | `bug-outline` |
| Compartir de Safari (pasos para instalar en iPhone) | `share-outline` |
| Elegir una captura | `image-outline` |
| Ver el mapa en grande (sobre el mini mapa) | `expand-outline` |
| Procesar pendientes ahora (moderación) | `refresh-outline` |
| Reactivar el reconocimiento (moderación) | `play-outline` |

### 5.1 Ícono de la app

La chapita del logo (sección 5.2) en `fondo` del claro, con la S y el agujero calados, y la argolla en `texto`, sobre `primario` del claro, que llena todo el cuadrado. Sin texto ni degradés, y sin esquinas redondeadas: las pone cada sistema. Es `assets/marca/spot-icono.svg`.

- **Legible a 48 px** y en claro y oscuro: lleva su propio fondo, así no depende del fondo del sistema.
- **Zonas seguras:** en `icon.png` el dibujo llega al 76,5 % del radio, dentro del círculo del 80 % que respetan las máscaras (maskable e iOS). En el adaptativo de Android también llega al 76,5 %, fuera del círculo de 66 de 108 (61 %): en los lanzadores con máscara redonda se corta el borde de la argolla. Hay que achicar el frente y el monocromo en el archivo (ver la sección 10).
- **Archivos** (`assets/images/`, dibujados con el logo):

  | Archivo | Medida | Qué es |
  | --- | --- | --- |
  | `icon.png` | 1024, sin transparencias | El ícono, también el de iOS (`app.json`, `icon`) |
  | `android-icon-foreground.png` | 512 | La chapita y la argolla sobre transparente |
  | `android-icon-background.png` | 512 | El `primario` liso (`adaptiveIcon.backgroundColor` también es `#556B2F`) |
  | `android-icon-monochrome.png` | 432 | La forma, para los íconos con el color del tema (Android 13 o posterior) |
  | `favicon.png` | 48 | La pestaña del navegador: dibujado aparte, con las esquinas redondeadas y la chapita más grande para que se lea. El export lo convierte en `favicon.ico` |
  | `splash-icon.png` | 228 × 244 | La chapita sola, sobre el `primario` de la pantalla de carga nativa (`expo-splash-screen`) |

- **Los de la web** (`public/iconos/`: 192, 512, maskable de 512 y el de iPhone de 180) salen de `icon.png` con `python3 scripts/iconos-web.py`.
- **Cómo reemplazarlo:** poné los archivos nuevos en `assets/images/` con los mismos nombres y medidas y corré `python3 scripts/iconos-web.py`: rehace los de la web. El favicon se reemplaza a mano. Si cambian los colores de fondo, cambialos también en `app.json` (`adaptiveIcon` y `expo-splash-screen`).

### 5.2 Logo

Una chapita de collar con una S, colgada de su argolla, y al lado la palabra "Spot". Todo está dibujado en formas: no hace falta tener la fuente instalada.

**Archivos** (`assets/marca/`, la fuente oficial; no se redibujan):

| Archivo | Qué es | Para qué |
| --- | --- | --- |
| `spot-logo.svg` | El logo completo, 274 × 107 | Fondos claros: Ingresar y Registrarse, documentos |
| `spot-logo-oscuro.svg` | El logo completo para fondos oscuros | Lo mismo, en modo oscuro |
| `spot-marca.svg` | Solo la chapita, 316 × 337 | Espacios chicos o cuadrados, en claro |
| `spot-marca-oscuro.svg` | Solo la chapita para fondos oscuros | Lo mismo, en modo oscuro |
| `spot-marca-negro.svg` | La chapita en un color, `texto` del claro | Sellos, impresiones en un color |
| `spot-marca-blanco.svg` | La chapita en blanco | Sobre fotos o fondos oscuros que no son de la paleta |
| `spot-icono.svg` | El ícono de la app, 1024 × 1024 | El original de los PNG de la sección 5.1 |

**Colores** (de `tema.ts`; `__tests__/marca.test.ts` comprueba que cada archivo use los de su esquema):

| Parte | Claro | Oscuro | En el ícono |
| --- | --- | --- | --- |
| Chapita | `#556B2F` (`primario`) | `#8FA357` (`primario`) | `#F6F6F2` (`fondo`) sobre `#556B2F` |
| Argolla y palabra | `#151613` (`texto`) | `#EDEEE6` (`texto`) | — |

- **Calados:** la S y el agujero de la chapita dejan ver el fondo. No se rellenan.
- **Margen libre:** alrededor del logo, como mínimo el diámetro de la argolla.
- **Tamaños mínimos:** 24 px para la chapita sola y 96 px de ancho para el logo completo.
- **En la app:**
  - **Ingresar y Registrarse** (`MarcaAcceso`, 7.7): el logo completo de 180 de ancho, en claro u oscuro según el esquema, con `expo-image`. Es el encabezado de la pantalla, con el nombre accesible "Spot", y se pide primero (prioridad alta, sin carga diferida).
  - **Pantalla de carga web** (7.9): el mismo logo, en SVG en línea.
  - **Íconos:** sección 5.1.
- **Qué no hacer:**
  - rotarlo ni deformarlo;
  - cambiarle los colores;
  - reescribir la palabra con otra fuente;
  - ponerlo sobre una foto sin un fondo liso.

## 6. Componentes

### 6.1 Botón

Todas las variantes tienen 54 de alto, radio `redondo` y texto `boton`.

| Variante | Fondo | Texto | Uso |
| --- | --- | --- | --- |
| `primario` | `primario` | `textoSobrePrimario` | Lo vi, Publicar, Ingresar |
| `secundario` | transparente, borde 1,5 en `texto` | `texto` | Escribir |
| `suave` | `superficie` | `primario` | Acciones dentro de bloques tintados, como Ver el otro reporte |
| `fantasma` | transparente | `primario` | Acciones de texto, como Ver lista |
| `peligro` | transparente | `peligro` | Denunciar, Cerrar sesión |

**Estados:**

- Presionado o con hover en web: `primarioPresionado` para el primario, y `superficieSuave` como fondo para las demás variantes.
- Deshabilitado: opacidad 0,45.
- Foco en web: anillo de 2 px en `primario`, separado 2 px del botón.

### 6.2 Chip de filtro

- Alto 44, radio `redondo`, relleno horizontal de 16 a 18, texto Figtree 600 15.
- **Inactivo:** sobre el mapa, `superficie` con sombra; en pantallas normales, `superficieSuave` sin sombra.
- **Activo:** `inverso` con `textoInverso`.
- Si el chip representa perdidos o encontrados, lleva un punto de 10 px a la izquierda, en `perdido` o en `primario`.

### 6.3 Etiqueta de estado

Cápsula de 26 a 28 de alto, relleno horizontal de 10 a 12 y texto `etiqueta`. Los colores salen de la tabla 2.3.

### 6.4 Chip de dato

Fondo `superficieSuave`, 34 de alto, radio `redondo`, Figtree 600 14. Muestra los datos del animal: especie, tamaño, color y collar.

### 6.5 Botón redondo flotante

De 44 a 52, fondo `superficie` con sombra y ícono en `texto`. El de mi ubicación lleva el ícono en `primario`. Se usa sobre el mapa y sobre la foto del detalle.

### 6.6 Marcador del mapa

**Forma final:**

- Círculo de 48 con la foto del animal (58 si está seleccionado).
- Borde interno de 3 en `superficie`.
- Anillo exterior de 3 en el color del tipo.
- Debajo, una colita: un rombo de 12 del mismo color.
- **Perdido:** además lleva un halo de 9 a 10 px con `perdido` al 22 % de opacidad.

**Clusters.** Círculo `inverso` con el número en `textoInverso` y borde de 3 en `superficie`, de 44 de diámetro como mínimo (56 desde 50 puntos), porque se tocan. Reemplaza al cluster verde actual.

**Mi ubicación.** Punto de 16 en `texto`, con borde de 3 en `superficie` y halo de 44 en `texto` al 10 % (12 % en oscuro).

**Foto en todos los marcadores** (desde la Fase 8, con las miniaturas): cada punto suelto que se ve es un marcador con su miniatura; los clusters siguen siendo capas de círculos. Debajo de cada foto hay una zona táctil casi transparente (ver `docs/DECISIONES.md`, "Foto en todos los marcadores").

`estilosCapa.ts` recibe la paleta como parámetro. Así sirve igual para web y nativo, claro y oscuro.

### 6.7 Hoja inferior "Cerca tuyo"

- Fondo `superficie`, radio `hoja` solo arriba y manija de 40 × 5 en `borde` (con hover o presionada, `textoSecundario`).
- **Barra** (75 de alto): la manija y, debajo, el título `subtitulo` "Cerca tuyo" con la cantidad de casos en `secundario` ("7 casos"), y a la derecha la acción "Ver lista" (botón `fantasma`), que abre la lista de casos con los filtros del mapa.
- Contenido: carrusel horizontal de tarjetas de 224 de ancho, separadas 12.
- Los casos se ordenan por distancia al centro del mapa, calculada en el cliente.
- Al tocar un marcador, su tarjeta pasa a ser la primera. Las tarjetas son `TarjetaCaso`.
- **Dos posiciones** (solo en el celular; en medio y amplio no hay hoja):
  - *abierta:* el menor entre 300 y el 38 % del alto de la pantalla;
  - *plegada:* solo la barra. El mapa usa todo el alto; el botón de mi ubicación baja con la hoja y los créditos del mapa, al soltarla.
- **Cómo se cambia:** arrastrando la barra hacia abajo o hacia arriba (sigue al dedo; al soltar va a la posición más cercana o, si el gesto fue rápido, hacia donde iba), o tocándola. Toda la barra es el botón, menos "Ver lista". El arrastre no mueve el mapa ni la página. Se anima en 220 ms; con movimiento reducido, sin animación.
- **Accesible:** el botón se anuncia "Ocultar casos" o "Mostrar casos", con `aria-expanded`, y funciona con Enter y Espacio. Plegada, el carrusel no se dibuja (no se llega a sus tarjetas con Tab).
- Al tocar un marcador con la hoja plegada, se despliega con esa tarjeta primera.
- La posición se guarda en el dispositivo, como la apariencia. Sin casos, la hoja es solo la barra.
- **Al final del carrusel, la entrada al muro de reencuentros** (`TarjetaReencuentros`): del ancho de una tarjeta (224) y del mismo alto, fondo `primarioSuave`, borde de 1,5 del mismo color (con hover o presionada, `primario`), radio `l` y relleno de 16. Arriba, un círculo de 44 en `superficie` con `heart-outline` de 22 en `textoPrimarioSuave`; abajo, "34 volvieron a casa" (o, con menos de 5, "Los primeros reencuentros de Spot") en `tituloTarjeta` y `textoPrimarioSuave`, y "Ver historias" en `etiquetaCampo` y `primario`. Es un link: lleva a `/reencuentros`. Se pide recién cuando el mapa mostró sus casos; si el contador no carga, no aparece. En medio y amplio va como fila al final de la lista del panel (en fila, relleno de 12). Sin casos cerca, la hoja es solo la barra y no se ve: el muro sigue a mano desde Perfil.

### 6.8 Tarjeta de caso

- Foto de 224 × 124, radio `l`, con la etiqueta de estado arriba a la izquierda (separada 10).
- Debajo, el título en `tituloTarjeta` y una línea `secundario`.

**Título:**

1. El nombre, si existe (Fase 6).
2. Si no, especie más color: "Gato gris atigrado".
3. Si no hay color, especie más tamaño.

**Línea secundaria.** Distancia y tiempo, por ejemplo "A 600 m, hace 40 min". El nombre del barrio queda pendiente (sección 10).

**Foto.** Las que se ven al abrir sin desplazar (dos en "Cerca tuyo", cuatro en las filas) aparecen apenas llegan, sin fundido; el resto entra con un fundido de 150 ms. Su texto alternativo es el título del caso.

### 6.9 Visto por última vez

- Tarjeta con borde de 1 en `borde`, radio `xl` y relleno de 14.
- **Mini mapa** de 140 de alto, radio `m` (es `MapaRecorrido` con los colores nuevos):
  - el último punto en el color del tipo, con halo;
  - los puntos anteriores, chicos y neutros;
  - una línea punteada en `textoSecundario` que los une.
- **Debajo:**
  - "Visto por última vez", en `secundario`;
  - la fecha, en `cuerpoFuerte`;
  - la nota del avistamiento, en `cuerpo`.
- **El mini mapa es un botón** ("Ver el mapa en grande") que abre el mapa en grande (6.9.1). En web, cursor de mano y el anillo de foco de siempre. Sobre su esquina inferior derecha, separado 8, un botón redondo chico de 36: ícono `expand-outline` de 20 en `texto`, fondo `superficie` con la sombra flotante (`superficieSuave` presionado o con hover). Se toca todo el mini mapa, así que el área táctil pasa de 44. El mapa de adentro no se anuncia: el nombre del botón ya lo dice.
- Solo en el detalle. El mini mapa de Publicar (`CampoUbicacion`) no cambia.

### 6.9.1 Mapa en grande del recorrido

Pantalla aparte (`/animal/<id>/mapa`), no una hoja: Atrás vuelve al detalle como desde cualquier pantalla. Si el caso no existe o está oculto para quien mira, va al detalle, que muestra "Esta publicación no está disponible." (o el error con Reintentar).

- **Mapa:** ocupa toda la pantalla y se mueve: arrastrar, pellizcar, doble toque y rueda del mouse. El mismo estilo base recoloreado en claro y oscuro, siempre al norte (sin rotar ni inclinar). En web, arrastrarlo no desplaza ni recarga la página.
- **Vista inicial:** todos los avistamientos a la vista, con 40 de margen fuera de los botones y la tarjeta, sin pasar de zoom 17. Las zonas de los aproximados entran enteras. Un solo lugar se centra con `ZOOM_PUNTO` (15).
- **Puntos:** como el mini mapa, en orden cronológico y unidos por la línea punteada (3 de ancho), pero más grandes y con su número de orden (1 es el más viejo), en Noto Sans Bold de 13 (15 el elegido):
  - los anteriores, círculos de 26 en `puntoInactivo` con borde de 2,5 en `superficie`;
  - el último, de 30 en el color del tipo, con halo de 54 al 22 %;
  - el elegido crece 6 y su borde pasa a `texto` (3,5);
  - el número va en el color de la paleta que más contraste tiene sobre su punto (al menos 4,5:1, lo comprueba `__tests__/recorridoGrande.test.ts`);
  - encimados, arriba va el elegido y, si no, el más nuevo.
- **Ubicaciones aproximadas** (las que la base guarda redondeadas a 3 decimales: donde se perdió y el "¿Dónde está ahora?" de un resguardo): no van como punto exacto sino como una zona, un círculo translúcido de 110 m de radio en el color del tipo (16 %), con borde de 2 del mismo color (`texto` si es el elegido). Mide 110 m en el mapa a cualquier zoom; de lejos, nunca menos de 16 de radio. El número va en el centro, en `texto` con borde de 2 en `superficie`. Ver "Ubicaciones aproximadas en el mapa" en `docs/DECISIONES.md`.
- **Arriba,** respetando el área segura (16 del borde superior y 20 de los lados): Volver (`chevron-back`) a la izquierda y Mi ubicación (`locate-outline`, en `primario`) a la derecha, botones redondos flotantes (6.5). Mi ubicación hace lo mismo que en el mapa principal y, sin permiso, muestra el mismo aviso debajo de los botones.
- **Tarjeta del punto elegido,** flotante abajo (16 sobre el borde inferior y el área segura, 20 de los lados): fondo `superficie`, radio `xl`, relleno de 16, sombra flotante y 420 de ancho como máximo. Al abrir, el último avistamiento. Muestra:
  - la miniatura de la foto (64, radio `s`), si tiene;
  - qué pasó, con los textos del Historial ("Lo vio Carla", "Se perdió acá"), en `cuerpoFuerte`;
  - la fecha con `diaYHora` ("Hoy a las 14:05"), en `secundario`;
  - la nota, en `cuerpo` y `textoCuerpo` (hasta 3 líneas);
  - en los aproximados, "Ubicación aproximada, unos 100 m a la redonda.", en `pequeno`;
  - abajo, "Anterior" y "Siguiente" (botones `secundario` de 44 de alto) y entre los dos "2 de 5", en `secundario`. Recorren los puntos en orden y centran el mapa en cada uno; en las puntas se apagan. Son la forma accesible de recorrer el mapa: al pasar de punto, el texto nuevo se anuncia.
- **Tocar un punto** (o su zona) lo elige y actualiza la tarjeta, sin mover el mapa. La zona táctil se agranda 12 alrededor del punto.
- **Medio y amplio:** el mapa ocupa el área de contenido (en amplio, con el riel visible) y la tarjeta va abajo a la izquierda.
- **Carga (web):** el mapa sale del mismo bloque aparte de MapLibre que los otros (`mapasWeb.ts`) y, en esta pantalla, se pide enseguida. No suma a la carga inicial de `/` más que sus textos y la ruta.

### 6.10 Posibles coincidencias

- Bloque con fondo `coincidenciaFondo`, radio `xl` y relleno de 18. El título "Posibles coincidencias" va en `tituloTarjeta`.
- Por cada coincidencia: dos fotos circulares de 64, superpuestas 16 px y con borde del color del fondo, y al lado el texto:
  - **Las del reconocimiento con IA** muestran el motivo en vez del porcentaje: arriba, el motivo que dio Claude en `cuerpoFuerte` ("Mismo collar rojo y mancha blanca en el pecho."); debajo, en `secundario`, quién y dónde ("Un perro encontrado a 1,2 km. Con 3 h de diferencia.").
  - **Las de antes** (las del servicio de embeddings, sin motivo) siguen con una oración en `cuerpo`: "Un perro encontrado a 1,2 km se parece en un 86 %."
- Se mantienen las tres acciones actuales:
  - "Es el mismo animal": botón `primario`;
  - "No es el mismo": botón `secundario`;
  - "Ver el otro reporte": botón `suave`.
- Las mismas reglas de hoy deciden quién ve cada acción.

### 6.11 Historial

Línea de tiempo vertical:

- Cada evento tiene un punto de 18 unido por una línea de 2 en `borde`.
- El evento más reciente lleva el punto relleno del color del tipo, con borde de 4 de su tono suave.
- Los anteriores llevan el punto hueco, en `superficie` con borde de 3 en `puntoInactivo`.

Texto de cada evento:

- quién hizo qué ("Lo vio Carla"), en Figtree 700 15;
- la nota, en `cuerpo`;
- para quien publicó el caso, en cada aviso de otra persona, "Escribirle": botón `fantasma` con ícono de globo, de 44 de alto (no 54, porque va dentro de la fila) y alineado con el texto;
- la fecha, en `pequeno` y `textoSecundario`.

### 6.12 Aviso contra estafas

- Fondo `avisoFondo`, radio `l`, relleno de 16 e ícono `shield-outline`.
- Texto de 14 en `textoCuerpo`: "Nunca pagues para recuperar a un animal. Si alguien te pide plata o datos de tu tarjeta, denuncialo."
- Aparece siempre en el detalle de un caso abierto.

### 6.13 Barra de acciones del detalle

- Fija abajo, con fondo `superficie` y borde superior de 1. Respeta el área segura inferior.
- Dos botones:
  - "Escribir", variante `secundario`, que ocupa 1 parte;
  - "Lo vi", variante `primario`, que ocupa 1,4 partes.
- Si hay dos personas a quienes escribir (quien publicó y quien lo resguarda), "Escribir" abre una elección entre las dos.
- Sin cuenta, los botones llevan al mismo flujo de `RequiereCuenta` de hoy.

### 6.14 Barra de pestañas

- Fondo `superficie`, borde superior de 1 y 80 de alto más el área segura.
- Pestañas: Mapa, Publicar, Actividad y Perfil.
- **Activa:** texto `primario`, con una cápsula de 56 × 30 en `primarioSuave` detrás del ícono.
- **Publicar:** siempre lleva su ícono en una cápsula de 40 × 30 en `inverso`.
- **Inactivas:** `textoSecundario`.
- **Novedades sin leer:** punto de 9 en `primario`, con borde de 2 en `superficie`.

### 6.15 Formularios

**Campo de texto:**

- Fondo `superficie`, borde de 1 en `bordeCampo`, radio `m` y 52 de alto (más en campos de varias líneas). El campo de mensaje de la conversación usa el mismo borde.
- Etiqueta arriba en `etiquetaCampo`.
- Con foco, borde de 2 en `primario`; con error, borde y mensaje en `peligro`.

**Interruptor:** con la vía activa en `primario` y la apagada en `textoSecundario` (con `borde` no se distinguía del fondo: 1,2:1; hace falta 3:1). El círculo va en `superficie` en los dos estados. La etiqueta también lo cambia, con 44 de alto. En web mide 56 × 28.

**Selector de foto:** recuadro grande con fondo `superficieSuave`, borde de 1 en `bordeCampo` (con hover o presionado, `textoSecundario`; con error, `peligro`), radio `xl` e ícono de cámara.

**Ubicación:** "Usar mi ubicación" y "Elegir en el mapa" son botones `secundario`, con borde de 1,5 en `texto`: ya superan 3:1 y no cambian.

### 6.16 Mensajes

| Tipo | Fondo | Texto |
| --- | --- | --- |
| Información | `superficieSuave` | `texto` |
| Error | `peligroSuave` | `peligro` |
| Éxito | `primarioSuave` | `textoPrimarioSuave` |

Todos van con radio `l` y relleno de 14 a 16. El indicador de carga usa `primario`.

### 6.17 Notificaciones en el celular (solo web)

- **La pregunta después de publicar,** arriba del contenido del caso recién publicado (una sola vez): bloque `superficieSuave`, radio `l`, relleno de 16. "¿Querés que te avisemos al celular cuando alguien lo vea?" en `cuerpoFuerte` y, debajo, "Sí, avisame" (`primario`, `notifications-outline`) y "Ahora no" (`fantasma`), en fila y repartidos. Si dice que sí, queda el mensaje de éxito "Listo: te vamos a avisar en este celular.".
  - *iPhone sin instalar:* en vez de "Sí, avisame", la explicación en `secundario` y "Instalar la app" (`secundario`, `download-outline`), que abre la hoja de los pasos (7.10).
  - *Navegadores de WhatsApp, Instagram y Facebook:* la explicación y "Abrir en Chrome o Safari" (`secundario`, `open-outline`), que abre la hoja de 7.10.
  - *Ya activadas, bloqueadas o un navegador que no puede:* no aparece.
- **El interruptor de Perfil** (La app, con cuenta, primero): `Interruptor` "Notificaciones en este celular" y, debajo, la ayuda en `secundario` (qué avisa y que en la pantalla bloqueada no se ven nombres, mensajes ni direcciones). Al prenderlo o apagarlo, un mensaje de éxito o de error. Si está bloqueado, en vez del interruptor la etiqueta sola y un mensaje de información con cómo volver a permitirlas (en el iPhone, en Android instalada, en Android en el navegador, en la computadora). En iPhone sin instalar y en los navegadores de las apps, lo mismo que la pregunta.
- **La notificación** la dibuja el sistema: el ícono de la app (`public/iconos/icono-192.png`), el título y una línea. Sin colores propios.

### 6.18 Historia para compartir

Una imagen de 1080 × 1920 que se arma en el celular (`src/features/historias/disenio.ts`) para las historias de Instagram o los estados de WhatsApp. Sigue la apariencia de la app (claro u oscuro). Instagram tapa unos 200 px arriba y abajo: todo va entre 200 y 1720.

- **Fondo:** el color dominante de la foto (como las tapas de Spotify), llevado hacia `superficie` en claro o hacia `fondo` en oscuro, de a 5 %, hasta que `texto` tenga 5,5:1; siempre se mueve al menos 35 % (claro) o 25 % (oscuro), para que la foto se despegue. Sin foto que se pueda dibujar, el mismo cálculo desde el color de la especie (`ColorHistoria` en `tema.ts`: perro `#A0703F`, gato `#5E7189`, otro `#556B2F`), que solo se usa acá.
- **Etiqueta** (x 80, y 214): cápsula de 84 de alto en `superficie`, relleno de 36, con un punto de 24 en `perdido` o `encontrado` y "SE PERDIÓ" o "ENCONTRADO" en Figtree 700 38, en `textoPerdido` o `textoEncontrado`. Es la única mayúscula sostenida del diseño: un cartel.
- **Foto** (x 80, y 334, 920 × 856, radio 64): llena el recuadro, recortada y centrada. Sin foto, el recuadro en `superficieSuave` con la chapita (`spot-marca` del esquema) de 240 en el centro.
- **Nombre** (línea de base 1306): el nombre o, si no tiene (o parece un contacto), la especie, en Fredoka 600 112 (se achica hasta 64 si no entra; después se corta con "…").
- **Qué animal** (1378): con nombre, "Perro marrón"; sin nombre, el color y el tamaño ("Gris, mediano"). Figtree 600 46. Si no hay nada, no va.
- **Fecha** (1444, o 1378 si no hay línea anterior): "Se perdió el 17 de octubre" o "Lo encontraron el 21 de octubre". Figtree 400 42.
- **Pedido** (1566): "Ayudá a encontrarlo en Spot" o "Ayudá a encontrar a su familia en Spot", Figtree 700 44.
- **Logo** (x 80, y 1600, 288 de ancho): el completo del esquema (`spot-logo.svg` o `spot-logo-oscuro.svg`), sobre el fondo liso.
- Todo el texto en `texto` del esquema. **Nunca** contactos, quién publicó, la descripción libre ni la ubicación.
- **La hoja** "Compartir en historias" (`MenuOpciones`): la vista previa de 320 de alto (9:16, radio `m`, sobre `superficieSuave`), un mensaje de información con la pista del sticker de enlace y el botón `primario` "Compartir la imagen" (`share-outline`) o, si el navegador no puede mandar archivos, "Descargar la imagen" (`download-outline`). Al copiar el link, el mensaje pasa a éxito: "Copiamos el link: sumalo con el sticker de enlace de Instagram.". Mientras se arma, el indicador y "Armando la imagen…"; si falla, el error y "Probar de nuevo".

### 6.18.1 Historia "VOLVIÓ A CASA"

La misma base de 6.18 (fondo, foto, logo y medidas), para compartir una historia del muro (`disenioReencuentro`):

- **Etiqueta:** "VOLVIÓ A CASA", con el punto en `encontrado` y el texto en `textoEncontrado`: el verde de "ya está en casa".
- **Nombre** (1306): el nombre si la familia quiso mostrarlo o, si no, la especie ("Perro").
- **Días** (1378): "Volvió a casa después de 5 días" o "el mismo día", Figtree 600 46 (se achica hasta 36).
- **La frase** (1440), entre comillas latinas («»), Figtree 400 38, en dos líneas como mucho con 50 de interlineado; si no entra, la segunda termina en "…»" (`partirEnLineas`).
- **Pedido** (1566): "Conocé más reencuentros en Spot".
- Lleva la frase porque la imagen la ve antes quien la comparte; nunca quién ayudó, contactos ni dónde. El link que se copia es el de la historia (`/reencuentros/<id>`).

### 6.19 Muro de reencuentros

`/reencuentros`, una columna de 720 (`AnchoMaximo.lista`), sin cuenta:

- **Arriba,** la introducción en `secundario` ("Animales que volvieron a casa, contados por sus familias.").
- **El contador:** un bloque `primarioSuave` de radio `xl`, relleno de 20 y 120 de alto como mínimo. El número en `contador` y, debajo, "animales volvieron a casa con Spot" en `cuerpoFuerte`, los dos en `textoPrimarioSuave`. Con menos de 5 reencuentros no hay número: "Los primeros reencuentros de Spot" en `titulo`. Para los lectores de pantalla es un encabezado con la frase entera ("34 animales volvieron a casa con Spot"). Mientras carga, el mismo bloque con el indicador; si falla, no se muestra.
- **Las historias,** separadas 16, de la más reciente a la más vieja, de a 20 ("Ver más historias", botón `fantasma`). Cada una es una tarjeta `superficie` con borde de 1 en `borde` y radio `xl`:
  - la foto del reencuentro (la mediana; si no carga, la original), a todo el ancho y en 4:3, sin oscurecer ni filtrar; las de la primera tarjeta, con prioridad alta;
  - el nombre (o "Un perro", "Un gato") en `tituloTarjeta`, como encabezado;
  - "Volvió a casa después de 5 días" en `cuerpoFuerte`;
  - la frase en `cuerpo` y `textoCuerpo`;
  - la fecha ("El 22 de octubre") en `pequeno`;
  - abajo a la derecha, botones redondos sin sombra: Compartir (`share-social-outline`), Compartir en historias (`logo-instagram`, solo web) y Más opciones (`ellipsis-horizontal`): "Denunciar la historia", que pide cuenta y términos como denunciar un caso, y, solo para la familia y moderación, "Ver el caso" (el caso tiene el mapa, la zona donde se perdió y los nombres del historial, y el formulario promete "sin tus datos ni dónde fue").
- **Sin historias:** "Todavía no hay historias…" en `secundario`.
- **`/reencuentros/<id>`** (el link de una): esa tarjeta sola y el botón `secundario` "Ver todos los reencuentros" (`heart-outline`). Si no existe o está oculta para quien mira, "Esta historia no está disponible.". La familia y moderación la ven aunque esté oculta, con el aviso de error arriba y sin los botones de compartir.
- **Nunca** ubicación, quién publicó, quién ayudó ni contactos. Capturas en `docs/reportes/2026-10-22-reencuentros/`.

### 6.20 Contar cómo volvió

- **Al marcar el caso como reunido** (solo la familia de un perdido), en vez del aviso "Listo" se abre un `MenuOpciones`: "¡Qué alegría!", con "¿Querés contar cómo volvió? También podés agradecerle a quien te ayudó.", la opción `primario` "Contar cómo volvió" (`heart-outline`) y "Ahora no" para cerrar.
- **En el detalle de un caso reunido,** después de Novedades del caso, "Cómo volvió" (`subtitulo`) con la tarjeta de la historia (sin el nombre, que ya es el título de la pantalla, y sin Más opciones), "Editar la historia" (familia, `secundario`) y "Ver todos los reencuentros" (`fantasma`). Si todavía no hay historia, solo la familia ve una invitación en `superficieSuave` de radio `l`: "¿Querés contar cómo volvió?" en `tituloTarjeta`, la ayuda en `secundario` y el botón `primario` "Contar cómo volvió".
- **El formulario** (`/animal/<id>/reencuentro`, columna de 560), con la intro de que es opcional y se puede editar o borrar:
  - *Tu historia (opcional):* el selector de foto con la del caso como vista previa y "Si no elegís una, usamos la foto del caso." (con una foto nueva, el botón `fantasma` "Usar la foto del caso"); el mensaje de información "Si en la foto aparecen personas, que estén de acuerdo en que se publique."; el campo "¿Cómo volvió?" (varias líneas) con "n de 280 · Hasta 280 caracteres. Los teléfonos, links y emails no se publican." en `pequeno` (en `peligro` si se pasa); y el interruptor "Mostrar el nombre (Toby)" con su ayuda.
  - *Agradecer (opcional):* la intro en `secundario` y una fila por persona que participó, separadas por `borde`: casilla de 24 (borde de 2 en `bordeCampo`, marcada en `primario` con `checkmark` en `textoSobrePrimario`), avatar de 40, el nombre en `cuerpoFuerte` y cómo ayudó en `secundario` ("Avisó que lo vio · Te escribió"). A quien ya se le agradeció, marcada, sin poder tocarla y con "Ya le agradeciste". Es un `checkbox` con `aria-checked`. Debajo, "Mensaje (opcional)". Sin participantes: "Nadie más participó en el caso.".
  - *Abajo, fijo,* el botón `primario`: "Publicar la historia", "Guardar los cambios" o, sin frase, "Agradecer" (`heart-circle-outline`), con los errores encima. Con la historia publicada, lleva a su página del muro.
  - *Editando,* al final, "Borrar la historia" (`peligro`), que confirma en un `MenuOpciones`.

## 7. Pantallas

Esta sección describe la versión de celular (compacta). La sección 8 indica cómo cambia en pantallas más anchas.

### 7.1 Mapa (inicio)

- El mapa ocupa toda la pantalla, por debajo de la barra de estado. Desaparece el encabezado con nombre y lema.
- Arriba, respetando el área segura, va una fila de chips flotantes:
  - Antes de la Fase 6: Todos, Perros, Gatos.
  - Desde la Fase 6: Todos, Perdidos, Encontrados.
- A la derecha de los chips, un botón redondo de filtros abre una hoja con el resto: especie, estado y antigüedad. Las tres filas de chips de hoy se mudan ahí.
- El botón de mi ubicación va a la derecha, justo encima de la hoja inferior, y baja con ella cuando se pliega.
- Abajo, la hoja "Cerca tuyo" (6.7) y la barra de pestañas.
- Los errores y el estado vacío ("No hay reportes con estos filtros.") aparecen como un mensaje flotante debajo de los chips.

### 7.2 Detalle del caso

**Cabecera:**

- Foto de 380 de alto como máximo (el menor entre 380 y el 45 % del alto), con esquinas inferiores de radio `cabecera`.
- Botones redondos flotantes: Volver a la izquierda; Seguir y Más opciones a la derecha.
- "Más opciones" contiene Editar el reporte y Borrar el reporte (solo para quien lo publicó) y Denunciar. Compartir es un botón redondo del encabezado y, a su derecha, "Compartir en historias" (`logo-instagram`; solo web y con el caso abierto, 6.18).
- Recién publicado, arriba del contenido va la pregunta de las notificaciones (6.17).
- La foto nunca se oscurece ni se filtra, tampoco en modo oscuro.

**Contenido** (relleno de 24), en este orden:

1. Avisos de estado, si corresponden: oculta por moderación (mensaje de error) o caso cerrado (mensaje de éxito).
2. Etiqueta de estado y, a su lado, en `secundario`: "Publicado hace 2 días" (desde la Fase 6, "Perdido desde el sábado 17").
3. Nombre o título, en `display`.
4. Descripción, en `cuerpo` y `textoCuerpo`.
5. Chips de datos: especie, tamaño, color y collar.
6. Contacto compartido por quien lo resguarda, si existe, en una tarjeta `superficieSuave`.
7. **"Novedades del caso":** botones `secundario` para "Me lo llevé / está resguardado", "Se reunió con su familia" y "Se volvió a escapar", según las reglas actuales de quién ve cada uno.
8. Visto por última vez (6.9). Tocar el mini mapa abre el mapa en grande (6.9.1).
9. Posibles coincidencias (6.10), si el caso no está reunido.
10. "Cómo volvió", si el caso está reunido (6.20).
11. Historial (6.11).
12. Aviso contra estafas (6.12).
13. Espacio final igual al alto de la barra de acciones (6.13).

**Si el caso fue vinculado,** se mantiene el comportamiento actual: el mensaje de redirección al caso principal (el bug B1 se corrigió en la migración 0007).

### 7.3 Publicar

- Título "Publicar", con la introducción en `secundario`.
- Formulario en una columna de 560 de ancho como máximo, centrada:
  - selector de foto grande arriba;
  - especie y tamaño con chips;
  - el resto de los campos;
  - la ubicación con un mini mapa de radio `m`.
- El botón primario "Publicar" va fijo abajo. Los campos no cambian.

### 7.4 Actividad

- Título.
- Control de dos opciones, Novedades y Mensajes, con el estilo de chips (activo en `inverso`).
- Filas de la lista:
  - ícono de 18 dentro de un círculo de 40 en `primarioSuave`;
  - título en Figtree 700 15;
  - cuerpo en `secundario`;
  - tiempo en `pequeno`;
  - punto de no leída en `primario`;
  - separadores de 1 en `borde`.
- Un agradecimiento ("La familia de Toby te agradeció", con el mensaje de la familia) lleva `heart-circle-outline` y abre el caso.

### 7.5 Conversación

- **Aviso de privacidad** arriba, en `secundario`.
- **Burbujas propias:** fondo `primario` y texto `textoSobrePrimario`, radio 20 con la esquina inferior derecha en 6.
- **Burbujas ajenas:** fondo `superficieSuave` y texto `texto`.
- **Entrada de texto:** cápsula de 52 de alto con borde de 1 en `bordeCampo`, más un botón redondo de 44 en `primario` para enviar.
- **Caso oculto por moderación:** sin el botón del caso en el encabezado; arriba de los mensajes, "Publicación no disponible" en `cuerpoFuerte` y el aviso de error "Esta publicación fue ocultada por moderación. Nunca pagues ni compartas datos de tu tarjeta.". En la lista de Actividad, el ícono de ojo tachado en lugar de la miniatura y "Publicación no disponible" en lugar de la especie.

### 7.6 Perfil

- **Título.**
- **Tarjeta de la persona:** avatar circular en `primarioSuave` con la inicial en Fredoka, el nombre y la nota de privacidad.
- **Apariencia** (sección nueva):
  - chips Automático, Claro y Oscuro;
  - ayuda: "Automático sigue la configuración de tu teléfono o computadora."
- **Mis reportes:** filas con miniatura de radio `s`, etiqueta de estado, texto y chevron.
- **Reencuentros** (con o sin cuenta, antes de Apariencia): con cuenta y si alguna familia le agradeció, "Ayudaste a reunir a 3 familias." en `cuerpoFuerte` (solo cuenta lo que una familia agradeció); y el botón `secundario` "Ver las historias" (`heart-outline`), que lleva al muro.
- **La app** (sección nueva, con o sin cuenta, antes de "Términos y privacidad"):
  - "Notificaciones en este celular": con cuenta y solo en web, primero (6.17).
  - "Instalar la app": botón `secundario` con `download-outline` y, debajo, la ayuda en `secundario`. Solo en web, si el navegador la puede instalar y no está instalada (ver 7.10).
  - "Reportar un error": botón `secundario` con `bug-outline`. Al mandarlo, un mensaje de éxito debajo.
- **Cerrar sesión:** botón `peligro`.
- **Sin sesión:** Apariencia y La app siguen visibles.

### 7.7 Ingresar y registrarse

Contenido centrado, de 420 de ancho como máximo:

- el logo completo de 180 de ancho (sección 5.2), en claro u oscuro según el esquema, y, debajo, el lema en `secundario`;
- los campos;
- si hay captcha (solo web, con la clave de Turnstile), la comprobación de Cloudflare a todo el ancho, arriba del botón, en el esquema de la app (claro u oscuro) y en español. Ocupa 65 de alto desde que se abre la pantalla, para que nada salte. Si no carga, un mensaje de error con **Reintentar**;
- el botón primario;
- un enlace `fantasma` para cambiar entre ingresar y registrarse.

### 7.8 Moderación y página no encontrada

- **Moderación:** arriba, chips "Denuncias", "Errores" y "Reconocimiento" (activo en `inverso`). El aviso de un error nuevo abre "Errores".
  - *Denuncias:* misma lista que Actividad. La marca "Oculta" usa una etiqueta con `peligroSuave` y `peligro`. La denuncia de una historia del muro lleva la etiqueta "Historia del reencuentro", la frase y los botones "Ver la historia" y "Ocultar la historia" (o "Volver a mostrar la historia"), aparte de los del caso.
  - *Errores:* chips "Pendientes (n)" y "Resueltos (n)". Cada reporte es una fila con la etiqueta "Pendiente" (`avisoFondo` y `texto`) o "Resuelto" (`superficieSuave` y `textoSecundario`), "Sin cuenta" si se mandó así, quién y cuándo en `pequeno`, qué pasó en `cuerpo` y un bloque `superficieSuave` de radio `l` con los datos (cada etiqueta en Figtree 700). "Ver la captura" (botón `fantasma`) la muestra entera, de 320 de alto, sobre `superficieSuave`. Los pendientes terminan con un campo "Nota para quien lo reportó (opcional)" y el botón `primario` "Marcar como resuelto"; los resueltos, con quién lo resolvió, cuándo y la nota.
  - *Reconocimiento:* el estado del reconocimiento con IA, sin la dirección de la función ni su secreto.
    - Arriba, una línea en `secundario` que explica qué hace: "La inteligencia artificial describe cada foto nueva…" (sin nombrar la marca; siempre confirma una persona).
    - Una tarjeta (borde de 1 en `borde`, radio `xl`, relleno de 16) con cada dato: el nombre en `secundario` y, debajo, el valor en `cuerpoFuerte`.
      - **Estado:** etiqueta "Configurado" (`primarioSuave` y `textoPrimarioSuave`), "Sin configurar" o "Apagado" (`avisoFondo` y `texto`), o "Pausado: sin crédito" (`peligroSuave` y `peligro`).
      - **Fotos pendientes,** con "n esperan un nuevo intento" en `pequeno` si hay.
      - **Fotos con error,** en `peligro` si hay, con la ayuda en `pequeno`.
      - **Llamadas a la IA hoy:** "12 de 300" (el tope del día); al llegar, la ayuda en `pequeno`.
      - **Costo estimado del mes:** "US$ 0,42" o "Menos de US$ 0,01", con la aclaración en `pequeno`.
      - **Errores de la IA:** "n hoy" (en `peligro` si hay) y, en `pequeno`, las últimas 5 llamadas que fallaron en la semana ("Hoy a las 14:05 · Comparar · Sin crédito") o "Ninguno en la última semana."
      - **Última foto procesada** y **última coincidencia,** con `diaYHora` o "Todavía ninguna".
    - Debajo, la ayuda del estado en un mensaje si no anda (sin configurar, apagado o pausado).
    - Si está pausado, el botón `primario` "Reactivar" (ícono `play-outline`) y su resultado en un mensaje.
    - El botón `secundario` "Procesar pendientes ahora" (ícono `refresh-outline`), apagado si no está configurado, está apagado o pausado, y el resultado en un mensaje.
    - Se actualiza sola cada 15 s mientras está a la vista.
- **No encontrado:** mensaje centrado con un botón para volver al mapa.

### 7.9 Pantalla de carga (web)

Lo que se ve desde el primer instante, antes de que llegue el JS: es solo HTML y CSS en `public/index.html` (`#carga`).

- Fondo `fondo`, el logo de 180 de ancho y, debajo, un indicador circular de 28 con borde de 3: la vía en `borde` y el arco en `primario`, girando. Con movimiento reducido no gira.
- **El logo** va en SVG en línea, con las formas de `assets/marca/spot-logo.svg` y sin colores propios: la chapita en `primario` y la argolla y la palabra en `texto`, del esquema activo. Así es el claro o el oscuro, cada uno con los colores de su archivo. Su nombre accesible es "Spot".
- Sigue el esquema elegido en Perfil (lo lee el script de `index.html`) o, si es Automático, el del sistema. Nunca hay destello blanco ni negro: el fondo del documento ya es el de la paleta.
- Se va cuando la app dibuja su primera pantalla con contenido (`src/lib/pantallaCarga.ts`), no apenas monta el marco, para que no quede un fondo vacío en el medio.
- Es la única excepción a `tema.ts` y `es-UY.ts`: cada color lleva un comentario con su token y una prueba comprueba que coincidan (`__tests__/indexHtml.test.ts`).

### 7.10 Instalar la app y reportar un error

**Instalar la app** (solo web):
- En Chrome y Edge (Android y computadora) el botón abre la ventana del navegador; no hay hoja propia.
- *iPhone y iPad:* una hoja (`MenuOpciones`) "Agregala a tu pantalla de inicio" con tres pasos numerados: un círculo de 28 en `primarioSuave` con el número en `etiqueta` y `textoPrimarioSuave`, y el texto en `cuerpo`. El primero lleva el ícono de Compartir dibujado (`share-outline` de 22 en `primario`, en un cuadrado de 40 en `superficieSuave` de radio `s`). Cierra con "Entendido".
- *Navegadores de WhatsApp, Instagram y Facebook:* una hoja "Abrila en Chrome o Safari" que nombra la app, con el link del sitio en `cuerpoFuerte` (seleccionable) y "Copiar el link" (`primario`); al copiar, el mensaje de éxito.
- *Ya instalada, en la app nativa o en un navegador que no la instala:* el botón no aparece.

**La app instalada** usa el manifest (`public/manifest.webmanifest`): nombre "Spot", `display: standalone` y `background_color` y `theme_color` en `fondo` del claro. En el navegador, `theme-color` tiñe la barra con `fondo` del esquema del sistema. Los íconos salen de `assets/images/icon.png` (192, 512, uno maskable y el de iPhone de 180): el de la sección 5.1.

**Reportar un error:** una `Hoja` con:
- "¿Qué pasó?" (obligatorio, de 10 a 1000 caracteres) y "¿Qué estabas haciendo? (opcional)", campos de varias líneas;
- con cuenta, "Captura de pantalla (opcional)": vista previa entera (`contain`) de 220 de alto sobre `superficieSuave`, radio `m`, con "Elegir una captura" o "Cambiar la captura" (`secundario`) y "Quitar la captura" (`fantasma`);
- sin cuenta, "Tu contacto (opcional)", con la ayuda de que solo lo ven los moderadores;
- un bloque `superficieSuave` de radio `l` con lo que se suma solo (pantalla anterior, navegador y sistema, tamaño de pantalla y versión), cada etiqueta en Figtree 700;
- al pie, "Mandar el reporte" (`primario`, `send-outline`). Los errores de cada campo aparecen al intentar mandarlo.

### 7.11 Mails

Los mails de la cuenta (confirmar, recuperar la contraseña, cambiar el email y enlace mágico) están en `supabase/templates/`. Ninguno lleva imágenes ni fuentes externas: Gmail y otros las bloquean o las piden a terceros.

- Fondo `fondo`; arriba, "Spot" en 28/32, negrita, en `primario`.
- Una tarjeta `superficie` con borde de 1 en `borde` y radio `xl` (24): el título en 22/28 y `texto`, el párrafo en 16/25 y `textoCuerpo`.
- El botón: cápsula `primario` con el texto en `textoSobrePrimario`, 16 en negrita. Debajo, en 14 y `textoSecundario`, cuánto dura el link y el mismo link escrito, en `primario`, por si el botón no anda.
- Al pie, en 13 y `textoSecundario`: por qué llegó el mail y qué hacer si no lo pidió la persona, y "Spot · Animales perdidos y encontrados en Montevideo".
- Ancho máximo de 480; en el celular ocupa todo el ancho con 16 de margen. Fuente del sistema (los clientes de correo no cargan Fredoka ni Figtree).
- Solo la paleta clara: los clientes de correo oscurecen por su cuenta, y con estos contrastes se sigue leyendo.

## 8. Adaptación a cualquier celular y computadora

Creá un hook `useDisposicion()` basado en `useWindowDimensions` que devuelva uno de tres valores según el ancho de la ventana.

| Disposición | Ancho | Dónde aparece |
| --- | --- | --- |
| `compacto` | menos de 600 | Cualquier celular, desde 320 px |
| `medio` | de 600 a 1023 | Ventanas angostas, tablets y celulares en horizontal (en web) |
| `amplio` | 1024 o más | Computadoras |

### 8.1 Mapa

- **Compacto:** como en la sección 7.1.
- **Medio:**
  - el mapa ocupa todo;
  - a la izquierda flota un panel de 360 de ancho, con margen de 16 y el alto disponible;
  - el panel tiene los chips arriba y una lista vertical de casos;
  - la barra de pestañas sigue abajo.
- **Amplio:** tres franjas de izquierda a derecha.
  1. Riel de navegación de 88 de ancho, con ícono y etiqueta. Publicar va arriba, como botón `inverso`. Si la versión instalada de las pestañas soporta `tabBarPosition: 'left'`, usalo; si no, armá un riel propio.
  2. Panel de casos de 400 de ancho, con chips y filtros arriba y una lista vertical de tarjetas horizontales: foto de 96 × 96 con radio `m`, a la derecha la etiqueta, el título y la distancia.
  3. El mapa, en el resto.
- En amplio no hay hoja inferior ni carrusel. Es deseable que el hover sobre una tarjeta resalte su marcador.

### 8.2 Detalle

- **Compacto:** una columna, con la barra de acciones fija abajo.
- **Medio:**
  - una columna centrada de 640 de ancho como máximo;
  - la foto con las cuatro esquinas en radio `hoja`, separada del borde superior;
  - la barra de acciones fija abajo, con el mismo ancho que la columna.
- **Amplio:** dos columnas dentro de un contenedor centrado de 1120 como máximo, con relleno de 32.
  - Izquierda (46 %): foto cuadrada de radio `hoja`, debajo los botones Escribir y Lo vi (no fijos) y el aviso contra estafas.
  - Derecha: todo lo demás, en el orden de la sección 7.2.
  - El riel de navegación sigue visible.

### 8.3 Las demás pantallas

Una columna centrada con ancho máximo:

| Pantalla | Ancho máximo |
| --- | --- |
| Publicar | 560 |
| Actividad, Perfil, Conversación, Moderación, muro de reencuentros | 720 |
| Contar cómo volvió | 560 |
| Ingresar y registrarse | 420 |

En amplio, el riel de navegación queda a la izquierda.

El mapa en grande del recorrido no es una columna: ocupa toda el área de contenido y su tarjeta va abajo a la izquierda (6.9.1).

### 8.4 Reglas generales

- **Ancho mínimo 320 px.** Nada de anchos fijos que desborden: flex, porcentajes y `maxWidth`. Nunca scroll horizontal de la página; solo el carrusel y la fila de chips se desplazan de costado.
- **Pantallas bajas** (celulares chicos o en horizontal): la hoja y la foto de cabecera usan los mínimos indicados en 6.7 y 7.2.
- **Áreas seguras** en todos los bordes (muesca, barra de gestos). El mapa va por debajo de la barra de estado; los controles respetan el margen superior.
- **Teclado:** probá Publicar, Conversación e Ingresar con el teclado abierto.
- **Texto grande del sistema:**
  - los párrafos crecen libres;
  - chips, pestañas y etiquetas usan `maxFontSizeMultiplier` de 1,3;
  - nada se superpone hasta ese nivel.
- **Web:**
  - cursor de mano en todo lo que se toca;
  - estados de hover (6.1);
  - foco visible con anillo de 2 px en `primario`;
  - orden lógico al navegar con Tab;
  - el carrusel también se desplaza con mouse o trackpad;
  - se respeta `prefers-reduced-motion`;
  - el Volver del encabezado mide 44 × 44 y se anuncia "Volver" (`BotonVolver`);
  - el mapa queda siempre al norte: dos dedos acercan y alejan, pero no rotan ni inclinan;
  - tirar hacia abajo no recarga la página (`overscroll-behavior-y: none` en `public/index.html`).
- **Orientación:** `app.json` fija vertical en celulares nativos y `supportsTablet` es falso en iOS. Se mantienen así hasta la Etapa 3. En web, la app se adapta a cualquier ancho.

## 9. Modo oscuro

**Preferencia:**

- Opciones: Automático (por defecto, sigue el sistema), Claro y Oscuro, en Perfil › Apariencia.
- Se guarda en el dispositivo con `zustand` y su `persist` sobre `@react-native-async-storage/async-storage`. Los dos ya están instalados.
- Funciona sin cuenta.

**Tema:**

1. `tema.ts` exporta `paletas.claro` y `paletas.oscuro` con el tipo `Paleta`.
2. `Espacio`, `Radio`, `Fuentes` y la escala tipográfica quedan sin colores.
3. Un hook `useTema()` devuelve la paleta activa, el esquema y la preferencia con su setter. Combina la preferencia guardada con `useColorScheme()`.

**Estilos:**

- Reemplazá los `StyleSheet.create` que usan colores por una función `crearEstilos((c: Paleta) => StyleSheet.create({...}))`, más un hook `useEstilos(crear)` memorizado por esquema.
- Hoy hay 37 archivos que importan `@/constants/tema`: migralos todos.
- Un ayudante `coloresDeEstado(c, estado, tipo)` devuelve `{ fondo, texto, anillo }` y reemplaza a `ColorEspecie` y `ColorEstado`.

**Sistema:**

- **Barra de estado:** su estilo sigue al esquema (`src/app/_layout.tsx`).
- **Navegación:** pasale un tema con `background`, `card`, `text`, `border` y `primary` tomados de la paleta, para evitar destellos blancos entre pantallas.
- **Web:** el fondo del documento sigue al tema desde el primer pintado.
- **`app.json`:**
  - `userInterfaceStyle` ya está en `automatic`;
  - el `backgroundColor` de la pantalla de carga pasa de `#1E6F5C` a `#556B2F`;
  - el fondo del ícono adaptable de Android pasa de `#E6F4FE` a `#F6F6F2`.
- El rediseño de los íconos de la app queda fuera de este trabajo.

**Mapa:**

- **Base:** el estilo Positron de OpenFreeMap, que es el más limpio, recoloreado con los tokens de mapa de cada esquema (antes del rediseño era Liberty).
- **Cómo recolorear:** descargá el JSON del estilo una vez y reemplazá los colores por tipo de capa (tierra, calles, parques, agua, etiquetas con su halo). Pasá el objeto resultante al mapa. Web y nativo usan el mismo JSON, igual que `estilosCapa.ts`.
- **Si el recoloreo no funciona:** para oscuro existe `https://tiles.openfreemap.org/styles/dark`, aunque OpenFreeMap aclara que todavía no está completo.
- **Variable de entorno:** `EXPO_PUBLIC_MAP_STYLE_URL` sigue sirviendo para cambiar el estilo base. Si el estilo no tiene las capas esperadas, se usa tal cual, sin recolorear.
- **Al cambiar de esquema,** el mapa cambia de estilo sin perder la posición ni la selección.

## 10. Lo que este rediseño no hace (pendientes)

| Pendiente | Por qué queda afuera | Cuándo |
| --- | --- | --- |
| Buscador "Buscar barrio o calle" | Necesita un servicio de geocodificación que todavía no se eligió | Decisión aparte. Mientras tanto, los chips suben al borde superior |
| Nombre del barrio en las tarjetas | Necesita geocodificación inversa | Mientras tanto, se muestra la distancia |
| Foto en todos los marcadores | Necesitaba miniaturas | Hecho en la Fase 8 |
| Perdidos, nombre del animal y uso real del naranja | Necesitaba `tipo_reporte` | Hecho en la Fase 6 |
| "Ver lista" y compartir con vista previa | Eran funciones nuevas | Hecho en la Fase 8 |
| Ícono de la app y arte de la pantalla de carga | Es trabajo gráfico aparte | Hecho: el logo de la chapita (secciones 5.1 y 5.2). Queda achicar el frente y el monocromo del ícono adaptativo de Android, que se cortan en los lanzadores redondos |

## 11. Textos nuevos o que cambian en `es-UY.ts`

| Clave | Texto |
| --- | --- |
| `mapa.cercaTuyo` | Cerca tuyo |
| `mapa.masFiltros` | Más filtros |
| `mapa.distancia(km)` | A 600 m / A 1,2 km |
| `animal.acciones.loVi` | Lo vi (antes "Lo vi acá también") |
| `animal.ultimaVez` | Visto por última vez |
| `animal.publicado(haceCuanto)` | Publicado hace 2 días |
| `animal.novedades` | Novedades del caso |
| `animal.masOpciones` | Más opciones |
| `animal.avisoEstafa` | Nunca pagues para recuperar a un animal. Si alguien te pide plata o datos de tu tarjeta, denuncialo. |
| `coincidencias.resumen(especie, km, porcentaje)` | Un perro encontrado a 1,2 km se parece en un 86 %. |
| `coincidencias.quienYDonde(especie, tipo, nombre, km)` | Un perro encontrado a 1,2 km. (debajo del motivo de la IA) |
| `reconocimiento.intro` | La inteligencia artificial describe cada foto nueva, la compara con los casos cercanos de la misma especie y sugiere posibles coincidencias. Siempre confirma una persona. |
| `reconocimiento.pausadoAyuda` | El servicio de IA se quedó sin crédito y el reconocimiento se pausó. Cargá crédito y tocá Reactivar: las fotos que esperan se procesan solas. |
| `reconocimiento.costo(usd)` | US$ 0,42 / Menos de US$ 0,01 |
| `reconocimiento.reactivar` | Reactivar |
| `mensajes.escribir` | Escribir |
| `mensajes.elegirDestinatario` | ¿A quién le querés escribir? |
| `perfil.apariencia` | Apariencia |
| `perfil.aparienciaOpciones` | Automático, Claro, Oscuro |
| `perfil.aparienciaAyuda` | Automático sigue la configuración de tu teléfono o computadora. |
| `mapa.ocultarCasos` / `mapa.mostrarCasos` | Ocultar casos / Mostrar casos |
| `mapa.cantidadCasos(n)` | 1 caso / 7 casos / Ningún caso con estos filtros |
| `perfil.laApp` | La app |
| `instalar.boton` | Instalar la app |
| `celular.interruptor` | Notificaciones en este celular |
| `celular.pregunta` | ¿Querés que te avisemos al celular cuando alguien lo vea? |
| `celular.si` / `celular.ahoraNo` | Sí, avisame / Ahora no |
| `avisosPush.visto.titulo(aAnimal)` | Alguien vio a Toby (en la pantalla bloqueada; ver `t.avisosPush`) |
| `avisosPush.mensaje.titulo(elAnimal)` | Tenés un mensaje nuevo sobre Toby |
| `historia.boton` | Compartir en historias |
| `historia.etiqueta` | SE PERDIÓ / ENCONTRADO (solo en la imagen) |
| `historia.pista` | Copiamos el link: sumalo con el sticker de enlace de Instagram. |
| `errores.boton` | Reportar un error |
| `errores.moderacion.errores` | Errores |
| `mapa.recorrido.verEnGrande` | Ver el mapa en grande |
| `mapa.recorrido.titulo` | Recorrido |
| `mapa.recorrido.anterior` / `mapa.recorrido.siguiente` | Anterior / Siguiente |
| `mapa.recorrido.posicion(n, total)` | 2 de 5 |
| `mapa.recorrido.aproximada` | Ubicación aproximada, unos 100 m a la redonda. |
| `animal.queHizo(tipo, nombre)` | Lo vio Carla / Se perdió acá (el Historial y el mapa en grande) |
| `reencuentros.contadorPrimeros` | Los primeros reencuentros de Spot |
| `reencuentros.contadorDetalle(n)` | animales volvieron a casa con Spot |
| `reencuentros.tarjeta(n)` / `reencuentros.verHistorias` | 34 volvieron a casa / Ver historias |
| `reencuentros.dias(n)` | Volvió a casa después de 5 días / el mismo día |
| `reencuentros.alegria.titulo` / `.pregunta` | ¡Qué alegría! / ¿Querés contar cómo volvió? También podés agradecerle a quien te ayudó. |
| `reencuentros.contar.avisoPersonas` | Si en la foto aparecen personas, que estén de acuerdo en que se publique. |
| `reencuentros.contar.comoAyudo` | Avisó que lo vio / Lo resguardó / Te escribió |
| `avisosPush.agradecimiento.titulo(deAnimal)` | La familia de Toby te agradeció |
| `perfil.ayudaste(n)` | Ayudaste a reunir a 1 familia. / a 3 familias. |
| `historia.reencuentro.etiqueta` | VOLVIÓ A CASA (solo en la imagen) |

El lema actual sigue en uso para el título de la página web.

## 12. Orden de trabajo

1. **Documentación.** Guardar este documento y actualizar `AGENTS.md` y `docs/DECISIONES.md` (sección 0).
2. **Base del tema:**
   - paletas, `Fuentes` y escala en `tema.ts`;
   - `useTema`, la preferencia guardada, `crearEstilos` y `useEstilos`, y `useDisposicion`;
   - fuentes cargadas en `_layout.tsx`;
   - barra de estado y tema de navegación;
   - cambios en `app.json`.
3. **Componentes base** de `src/components/ui`:
   - rediseñar `Boton`, `Chips`, `Etiqueta`, `CampoTexto`, `Interruptor`, `Mensaje`, `Pantalla`, `Hoja`, `Seccion`, `Texto` y `Cargando`;
   - crear los nuevos: chip de dato, botón redondo, aviso contra estafas y línea de tiempo.
4. **Mapa:**
   - estilo base recoloreado en claro y oscuro;
   - capas de marcadores nuevas;
   - chips flotantes, hoja de filtros y hoja "Cerca tuyo";
   - disposiciones medio y amplio con el riel.
5. **Detalle,** con el orden nuevo, la barra de acciones y las dos columnas en amplio.
6. **Resto de las pantallas:** Publicar, Actividad, Conversación, Perfil con Apariencia, Ingresar, Registrarse, Moderación y No encontrado.
7. **Limpieza:**
   - eliminar `ColorEspecie`, `ColorEstado` y todo color escrito a mano;
   - `grep -rnE "#[0-9A-Fa-f]{6}\b|rgba?\(" src` solo debe encontrar resultados en `src/constants/tema.ts`.
8. **Verificaciones, commit y reporte.**

## 13. Criterios de aceptación

**Verificaciones automáticas.** `npm run typecheck`, `npm run lint` y `npx expo export -p web` pasan sin errores.

**Código:**

- No hay colores fuera de `tema.ts`.
- No hay textos visibles fuera de `es-UY.ts`.
- Cada componente de mapa mantiene versión web y nativa con el mismo contrato.

**Acciones que siguen disponibles:**

- Lo vi.
- Me lo llevé / está resguardado.
- Se reunió con su familia.
- Se volvió a escapar.
- Seguir.
- Denunciar.
- Escribir a quien publicó y a quien lo resguarda.
- Confirmar, rechazar y ver el otro reporte en coincidencias.
- Moderación.
- Ingresar, registrarse y cerrar sesión.

**Pruebas manuales.** El reporte incluye esta lista, con lo que se probó y lo que no:

- En el navegador, a 320, 390, 768, 1024 y 1440 px de ancho, en claro y en oscuro.
- Cambio de Apariencia en Perfil: aplica al instante y se mantiene al recargar.
- Con texto grande del sistema y con navegación por teclado en web.
- En el mapa, perdidos y encontrados se distinguen también en escala de grises, gracias al halo.
- Ninguna pantalla tiene scroll horizontal.

**Reporte.** Va en `docs/reportes/AAAA-MM-DD-rediseno.md`, con las secciones de siempre: resumen, cambios por archivo, resultado de las verificaciones, pasos manuales y pendientes y riesgos.

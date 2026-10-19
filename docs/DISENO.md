# Encontrados · Plan de rediseño visual

Actualizado: 19 de octubre de 2026.

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
- **Nada de mayúsculas sostenidas ni emojis.** Los textos van en oraciones cortas, con voseo.

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

Cualquier combinación nueva de colores se verifica antes de usarla.

**Perdido y encontrado no se distinguen solo por el color.** El oliva y el naranja pueden confundirse con daltonismo, así que el marcador de un perdido siempre lleva halo.

## 3. Tipografía

| Familia | Rol | Pesos |
| --- | --- | --- |
| Fredoka | Títulos y nombres de animales | 600 |
| Figtree | Todo el resto | 400, 600 y 700 |

**Instalación.** Con `npx expo install @expo-google-fonts/fredoka @expo-google-fonts/figtree`. Se cargan con `useFonts` en `src/app/_layout.tsx`, manteniendo la pantalla de carga (`expo-splash-screen`) hasta que estén listas. Si fallan, se usa la fuente del sistema.

**Licencia.** Los paquetes son MIT (código) y SIL OFL 1.1 (fuentes). OFL permite incluir las fuentes en apps, pero no está en la lista de licencias de `AGENTS.md`. El dueño aprobó esta excepción para fuentes tipográficas: anotala en `docs/DECISIONES.md` y en la regla de licencias de `AGENTS.md`.

**Detalle técnico importante.** En Android, `fontWeight` no elige el peso de una fuente cargada. Cada peso es una familia aparte (por ejemplo `Figtree_700Bold`). Definí en `tema.ts` un objeto `Fuentes` que mapee cada variante a su `fontFamily`, y no dependas de `fontWeight`.

### Escala

| Variante | Fuente | Tamaño / interlineado | Uso |
| --- | --- | --- | --- |
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

**Clusters.** Círculo `inverso` con el número en `textoInverso` y borde de 3 en `superficie`. Reemplaza al cluster verde actual.

**Mi ubicación.** Punto de 16 en `texto`, con borde de 3 en `superficie` y halo de 44 en `texto` al 10 % (12 % en oscuro).

**Foto en todos los marcadores** (desde la Fase 8, con las miniaturas): cada punto suelto que se ve es un marcador con su miniatura; los clusters siguen siendo capas de círculos. Debajo de cada foto hay una zona táctil casi transparente (ver `docs/DECISIONES.md`, "Foto en todos los marcadores").

`estilosCapa.ts` recibe la paleta como parámetro. Así sirve igual para web y nativo, claro y oscuro.

### 6.7 Hoja inferior "Cerca tuyo"

- Fondo `superficie`, radio `hoja` solo arriba y manija de 40 × 5 en `borde`.
- Arriba: título `subtitulo` "Cerca tuyo" y, en el celular, la acción "Ver lista" (botón `fantasma`), que abre la lista de casos con los filtros del mapa.
- Contenido: carrusel horizontal de tarjetas de 224 de ancho, separadas 12.
- Los casos se ordenan por distancia al centro del mapa, calculada en el cliente.
- Al tocar un marcador, su tarjeta pasa a ser la primera. Las tarjetas son `TarjetaCaso`.
- Alto fijo: el menor entre 300 y el 38 % del alto de la pantalla.

### 6.8 Tarjeta de caso

- Foto de 224 × 124, radio `l`, con la etiqueta de estado arriba a la izquierda (separada 10).
- Debajo, el título en `tituloTarjeta` y una línea `secundario`.

**Título:**

1. El nombre, si existe (Fase 6).
2. Si no, especie más color: "Gato gris atigrado".
3. Si no hay color, especie más tamaño.

**Línea secundaria.** Distancia y tiempo, por ejemplo "A 600 m, hace 40 min". El nombre del barrio queda pendiente (sección 10).

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

### 6.10 Posibles coincidencias

- Bloque con fondo `coincidenciaFondo`, radio `xl` y relleno de 18. El título "Posibles coincidencias" va en `tituloTarjeta`.
- Por cada coincidencia: dos fotos circulares de 64, superpuestas 16 px y con borde del color del fondo, más una oración, por ejemplo "Un perro encontrado a 1,2 km se parece en un 86 %."
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

- Fondo `superficie`, borde de 1 en `borde`, radio `m` y 52 de alto (más en campos de varias líneas).
- Etiqueta arriba en `etiquetaCampo`.
- Con foco, borde de 2 en `primario`; con error, borde y mensaje en `peligro`.

**Interruptor:** con la vía activa en `primario` y la apagada en `textoSecundario` (con `borde` no se distinguía del fondo: 1,2:1; hace falta 3:1). El círculo va en `superficie` en los dos estados. La etiqueta también lo cambia, con 44 de alto. En web mide 56 × 28.

**Selector de foto:** recuadro grande con fondo `superficieSuave`, radio `xl` e ícono de cámara.

### 6.16 Mensajes

| Tipo | Fondo | Texto |
| --- | --- | --- |
| Información | `superficieSuave` | `texto` |
| Error | `peligroSuave` | `peligro` |
| Éxito | `primarioSuave` | `textoPrimarioSuave` |

Todos van con radio `l` y relleno de 14 a 16. El indicador de carga usa `primario`.

## 7. Pantallas

Esta sección describe la versión de celular (compacta). La sección 8 indica cómo cambia en pantallas más anchas.

### 7.1 Mapa (inicio)

- El mapa ocupa toda la pantalla, por debajo de la barra de estado. Desaparece el encabezado con nombre y lema.
- Arriba, respetando el área segura, va una fila de chips flotantes:
  - Antes de la Fase 6: Todos, Perros, Gatos.
  - Desde la Fase 6: Todos, Perdidos, Encontrados.
- A la derecha de los chips, un botón redondo de filtros abre una hoja con el resto: especie, estado y antigüedad. Las tres filas de chips de hoy se mudan ahí.
- El botón de mi ubicación va a la derecha, justo encima de la hoja inferior.
- Abajo, la hoja "Cerca tuyo" (6.7) y la barra de pestañas.
- Los errores y el estado vacío ("No hay reportes con estos filtros.") aparecen como un mensaje flotante debajo de los chips.

### 7.2 Detalle del caso

**Cabecera:**

- Foto de 380 de alto como máximo (el menor entre 380 y el 45 % del alto), con esquinas inferiores de radio `cabecera`.
- Botones redondos flotantes: Volver a la izquierda; Seguir y Más opciones a la derecha.
- "Más opciones" contiene Editar el reporte y Borrar el reporte (solo para quien lo publicó) y Denunciar. Compartir es un botón redondo del encabezado.
- La foto nunca se oscurece ni se filtra, tampoco en modo oscuro.

**Contenido** (relleno de 24), en este orden:

1. Avisos de estado, si corresponden: oculta por moderación (mensaje de error) o caso cerrado (mensaje de éxito).
2. Etiqueta de estado y, a su lado, en `secundario`: "Publicado hace 2 días" (desde la Fase 6, "Perdido desde el sábado 17").
3. Nombre o título, en `display`.
4. Descripción, en `cuerpo` y `textoCuerpo`.
5. Chips de datos: especie, tamaño, color y collar.
6. Contacto compartido por quien lo resguarda, si existe, en una tarjeta `superficieSuave`.
7. **"Novedades del caso":** botones `secundario` para "Me lo llevé / está resguardado", "Se reunió con su familia" y "Se volvió a escapar", según las reglas actuales de quién ve cada uno.
8. Visto por última vez (6.9).
9. Posibles coincidencias (6.10), si el caso no está reunido.
10. Historial (6.11).
11. Aviso contra estafas (6.12).
12. Espacio final igual al alto de la barra de acciones (6.13).

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

### 7.5 Conversación

- **Aviso de privacidad** arriba, en `secundario`.
- **Burbujas propias:** fondo `primario` y texto `textoSobrePrimario`, radio 20 con la esquina inferior derecha en 6.
- **Burbujas ajenas:** fondo `superficieSuave` y texto `texto`.
- **Entrada de texto:** cápsula de 52 de alto, más un botón redondo de 44 en `primario` para enviar.

### 7.6 Perfil

- **Título.**
- **Tarjeta de la persona:** avatar circular en `primarioSuave` con la inicial en Fredoka, el nombre y la nota de privacidad.
- **Apariencia** (sección nueva):
  - chips Automático, Claro y Oscuro;
  - ayuda: "Automático sigue la configuración de tu teléfono o computadora."
- **Mis reportes:** filas con miniatura de radio `s`, etiqueta de estado, texto y chevron.
- **Cerrar sesión:** botón `peligro`.
- **Sin sesión:** Apariencia sigue visible.

### 7.7 Ingresar y registrarse

Contenido centrado, de 420 de ancho como máximo:

- "Encontrados" en Fredoka 32;
- los campos;
- el botón primario;
- un enlace `fantasma` para cambiar entre ingresar y registrarse.

### 7.8 Moderación y página no encontrada

- **Moderación:** misma lista que Actividad. La marca "Oculta" usa una etiqueta con `peligroSuave` y `peligro`.
- **No encontrado:** mensaje centrado con un botón para volver al mapa.

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
| Actividad, Perfil, Conversación, Moderación | 720 |
| Ingresar y registrarse | 420 |

En amplio, el riel de navegación queda a la izquierda.

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
| Ícono de la app y arte de la pantalla de carga | Es trabajo gráfico aparte | Más adelante |

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
| `mensajes.escribir` | Escribir |
| `mensajes.elegirDestinatario` | ¿A quién le querés escribir? |
| `perfil.apariencia` | Apariencia |
| `perfil.aparienciaOpciones` | Automático, Claro, Oscuro |
| `perfil.aparienciaAyuda` | Automático sigue la configuración de tu teléfono o computadora. |

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

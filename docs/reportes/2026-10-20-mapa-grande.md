# Mapa en grande del recorrido

Rama `claude/animales-repo-mxm2ja`, desde `main` en `bb559b3`. 20 de octubre de 2026.

## 1. Resumen

**Qué se pidió:** que el mini mapa de "Visto por última vez" abra un mapa en grande del recorrido, como pantalla aparte (`/animal/<id>/mapa`).
- **El mapa:** interactivo, con los puntos numerados en orden.
- **Puntos aproximados:** los que la base guarda redondeados se dibujan como una zona de unos 110 m, no como un punto exacto.
- **Tarjeta:** muestra el punto elegido, con Anterior y Siguiente.
- **Botones:** Volver y Mi ubicación.
- **Pantallas anchas:** su propia disposición en medio y amplio.
- **Carga:** sin sumar peso a la carga inicial de `/`.
- **Base de datos:** sin cambios.

**Qué se hizo:**

- **Mini mapa (detalle):**
  - es un botón "Ver el mapa en grande", con el botón chico `expand-outline` abajo a la derecha;
  - en web, cursor de mano y anillo de foco;
  - el mapa de adentro no se anuncia ni recibe toques;
  - el de Publicar no cambia.
- **Pantalla nueva `src/app/animal/[id]/mapa.tsx`.**
  - **Mapa:** a pantalla completa, se mueve con los gestos de siempre y no rota ni se inclina.
  - **Vista inicial:** encuadra todos los puntos con margen (zoom máximo 17). Un solo lugar se centra con `ZOOM_PUNTO`.
  - **Puntos:** numerados del más viejo al más nuevo. El último va en el color del tipo, con halo. El elegido se agranda y se marca con un borde en `texto`.
  - **Zonas aproximadas:** de 110 m reales a cualquier zoom, para donde se perdió y para el resguardo.
  - **Tarjeta flotante:**
    - qué pasó, con los mismos textos del Historial;
    - la fecha, la nota y la miniatura;
    - "Ubicación aproximada, unos 100 m a la redonda." en los puntos aproximados;
    - Anterior y Siguiente, con "2 de 5".
  - **Botones de arriba:** Volver y Mi ubicación.
  - **Medio y amplio:** el mapa ocupa el área de contenido, con el riel a la vista, y la tarjeta va abajo a la izquierda.
- **Caso inexistente, oculto, con error o unido a otro:**
  - si no existe, está oculto o da error, la pantalla manda al detalle, que muestra "Esta publicación no está disponible." (o el error con Reintentar);
  - si está unido a otro, va al mapa del caso principal.
- **Carga:**
  - el mapa sale del mismo bloque de MapLibre (`mapasWeb.ts`);
  - en `/`, el navegador baja **218 bytes más con gzip (+0,04 %)**: solo los textos nuevos y el registro de la ruta.

Verificado en la base (sin cambiarla): se guardan redondeados a 3 decimales el punto de un perdido al publicar (`publicar_animal`, 0010 y 0011) y el "¿Dónde está ahora?" de un resguardo (`cambiar_estado_animal`, desde la 0013). Antes de la 0013, el resguardo se guardaba exacto. `editar_reporte` (0012) no toca ubicaciones.

## 2. Cambios

| Archivo | Por qué |
| --- | --- |
| `src/app/animal/[id]/mapa.tsx` (nuevo) | La pantalla. **Datos:** carga el caso y sus avistamientos. **Puntos:** los ordena y elige el último. **Márgenes:** mide la tarjeta para pasarle al mapa lo que tapan los botones y la tarjeta. **Botones:** Anterior y Siguiente, Volver (`back()` o, sin historial, el detalle) y Mi ubicación (la misma lógica y el mismo aviso que el mapa principal). **Sin caso:** si no existe, está oculto, da error o no tiene avistamientos, va al detalle; si está unido, al mapa del principal. |
| `src/features/mapa/recorrido.ts` (nuevo) | Lógica pura de la pantalla: **orden y numeración** (`ordenarRecorrido`: por fecha y, si empatan, por id), **qué punto es aproximado** (`esUbicacionAproximada`: `perdido` y `resguardado`), **Anterior y Siguiente en las puntas** (`indiceVecino`, `hayAnterior`, `haySiguiente`) y el **GeoJSON** (`recorridoGrandeAGeoJSON`). |
| `src/features/mapa/encuadre.ts` (nuevo) | Lógica pura del mapa: **vista inicial** (`encuadrar`, Web Mercator de 512, con las zonas enteras, margen de 40 y tope de zoom 17), **radio de la zona** en píxeles por zoom (`paradasRadioZona`: 110 m exactos, mínimo 16 px) y **los puntos y la latitud** sacados del GeoJSON. Va aparte de `recorrido.ts` para que en web cada uno quede en su bloque (ver `docs/DECISIONES.md`). |
| `src/lib/contraste.ts` (nuevo) | Contraste WCAG entre dos colores de la paleta y `masLegible`, para el color del número de cada punto. |
| `src/components/mapa/MapaRecorridoGrandeGL.tsx` (nuevo) | Versión web con MapLibre GL JS. **Mapa:** se crea con la vista inicial y `setPadding(margenes)`; con otro esquema, cambia de estilo. **Toque:** elige el punto más cercano a ±12 px del dedo. **Ref `irA`:** centra sin cambiar el zoom (Anterior y Siguiente) o vuela con zoom (Mi ubicación). **Selección:** solo actualiza los datos. |
| `src/components/mapa/MapaRecorridoGrande.web.tsx` (nuevo) | Envoltorio liviano. Carga `MapaRecorridoGrandeGL` desde `mapasWeb.ts` con `lazy` y muestra el fondo del mapa mientras llega. Acá el mapa es lo que se vino a ver: pide el estilo y las fuentes enseguida. |
| `src/components/mapa/MapaRecorridoGrande.tsx` (nuevo) | Versión nativa con MapLibre React Native v11, con las mismas capas. Mide su tamaño antes de dibujar (la vista inicial lo necesita) y usa `onPress` de la fuente con `hitbox`. **No se probó en un dispositivo** (sección 5). |
| `src/components/mapa/estilosCapa.ts` | **Capas del mapa en grande:** zona, línea, halo, punto y número, con sus filtros, medidas (`PUNTO_GRANDE`) y orden de dibujo (encimados, arriba el elegido o el más nuevo). **Número:** Noto Sans Bold, como los clusters, en el color de la paleta con más contraste sobre su punto. |
| `src/components/mapa/capasWeb.ts` | `agregarCapasRecorridoGrande`: las cinco capas en web. |
| `src/components/mapa/mapasWeb.ts` | Exporta `MapaRecorridoGrandeGL` desde el único bloque de MapLibre. |
| `src/components/mapa/tipos.ts` | Solo tipos (el archivo va en `__common`): `PropiedadesPuntoGrande`, `ColeccionRecorridoGrande`, `MapaRecorridoGrandeRef` y `MapaRecorridoGrandeProps`, el contrato común de web y nativo. |
| `src/components/reportes/VistoPorUltimaVez.tsx` | **El mini mapa es un `Pressable`:** botón "Ver el mapa en grande" con el círculo de 36 con `expand-outline` (20) arriba. **El mapa de adentro:** `aria-hidden` y sin toques; en nativo, si no, se quedaría con el toque. |
| `src/components/reportes/DetalleCaso.tsx`, `src/app/animal/[id]/index.tsx` | `onVerMapa`, que abre `/animal/<id>/mapa`. |
| `src/components/reportes/Historial.tsx` | Usa `t.animal.queHizo` (el mismo texto que antes), así la tarjeta del mapa no repite la lógica. |
| `src/app/_layout.tsx` | `Stack.Screen` de `animal/[id]/mapa`: sin encabezado y con título "Recorrido". |
| `src/i18n/es-UY.ts` | **Textos nuevos:** `mapa.recorrido` ("Ver el mapa en grande", "Recorrido", "Anterior", "Siguiente", "{n} de {total}", "Ubicación aproximada, unos 100 m a la redonda."). **Función nueva:** `animal.queHizo(tipo, nombre)`, para "Lo vio Carla" y "Se perdió acá". |
| `__tests__/recorridoGrande.test.ts` (nuevo) | 23 pruebas, en la sección 3. |
| `docs/DISENO.md` | **Componente nuevo:** 6.9.1 "Mapa en grande del recorrido", con la regla de las ubicaciones aproximadas. **Otros cambios:** el mini mapa como botón (6.9), el ícono `expand-outline` (5), el orden del detalle (7.2), la pantalla en medio y amplio (8.3) y los textos nuevos (11). |
| `docs/DECISIONES.md` | **Decisiones nuevas:** "Ubicaciones aproximadas en el mapa" (la regla de privacidad) y "El mapa en grande, una pantalla en el bloque de MapLibre". |
| `docs/PRUEBAS-MANUALES.md` | **Flujo 25** (mapa en grande). Se hace con Toby resguardado, entre el 17 y el 18: el 17 lo indica, porque en el 19 Toby se borra. Duración total: unos 70 minutos. |
| `docs/ARQUITECTURA.md`, `README.md`, `AGENTS.md` | La pantalla nueva, sus módulos y la regla de las ubicaciones aproximadas. |
| `docs/reportes/2026-10-20-mapa-grande.md` | Este reporte. |

## 3. Verificaciones

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores (salida 0). |
| `npm run test` | 17 suites, **180 pruebas pasan** (157 de antes y 23 nuevas). |
| `npx expo export -p web` | `Exported: dist`, sin errores. |

**Pruebas nuevas** (`__tests__/recorridoGrande.test.ts`):
- **Orden y numeración:**
  - del más viejo al más nuevo, desde 1, con el último marcado;
  - los empates van por id, en cualquier orden de llegada;
  - no modifica la lista que recibe;
  - un solo punto es el 1 y el último.
- **Cuáles son aproximados:** `perdido` y `resguardado` sí; `visto` y `encontrado` no.
- **Anterior y Siguiente:**
  - avanzan de a uno;
  - en las puntas se quedan y se apagan;
  - con un punto, ninguno va a ningún lado.
- **GeoJSON:** la línea va en orden y cada punto lleva su número, si es aproximado y si está elegido; con un punto no hay línea.
- **Vista inicial:**
  - un solo avistamiento, o varios en el mismo lugar, se centran con zoom 15;
  - varios entran todos con 40 de margen fuera de botones y tarjeta, y el más justo toca el margen;
  - las zonas aproximadas entran enteras;
  - dos puntos pegados no pasan de zoom 17;
  - una ventana mínima no da zoom negativo.
- **Zona:**
  - mide 110 m en el mapa en los zooms 14, 15, 15,5, 17 y 19,25;
  - de lejos no baja de 16 px;
  - 110 m cubren el peor error del redondeo (unos 72 m).
- **Números:**
  - se leen a 4,5:1 o más sobre todos los colores de punto, en claro y en oscuro;
  - el contraste coincide con la tabla 2.4 de `DISENO.md` (botón primario, 5,9:1).

### En el navegador (Chromium, con el Supabase simulado)

Se probó con el build de prueba y datos simulados:
- un perdido con 5 puntos: donde se perdió, dos "Lo vio" (uno de una cuenta borrada), un resguardo y otro "Lo vio";
- un caso con dos puntos a la misma latitud;
- un caso con dos puntos en el mismo lugar.

Pasan las **36 comprobaciones**.

**Celular (390 × 844, con toque):**
- **Mini mapa:**
  - cursor de mano;
  - el mapa de adentro no se anuncia (`aria-hidden`);
  - tocarlo abre `/animal/a5/mapa`.
- **Al abrir:**
  - la tarjeta muestra "Lo vio Martín", la nota y "5 de 5", con Siguiente apagado;
  - los 5 puntos quedan entre los botones y la tarjeta (zoom 14,46, menos de 17).
- **Anterior:**
  - pasa a "4 de 5", el resguardo, con "Ubicación aproximada, unos 100 m a la redonda.";
  - centra el punto en lo visible (x = 195, y = 354, lo esperado);
  - en el 1 dice "Se perdió acá", con el aviso de aproximada, y se apaga;
  - tocarlo apagado no cambia nada.
- **Siguiente:** "2 de 5", exacto. El 3 dice "Lo vio una cuenta eliminada".
- **Gestos:**
  - arrastrar con un dedo mueve el mapa sin desplazar ni recargar la página (scroll en 0, la marca puesta en `window` sigue);
  - el canvas tiene `touch-action: none`;
  - pellizcar acerca (14,46 → 16,53) y el doble toque también (→ 17,53);
  - no rota ni se inclina (bearing y pitch en 0).
- **Atrás y Volver:**
  - Atrás del navegador vuelve al detalle, y el botón Volver también;
  - entrando directo, sin historial, Volver va al detalle.
- **Tocar un punto:** lo elige y cambia la tarjeta ("1 de 2", "Lo encontró Carla"), sin mover el mapa.
- **Caso inexistente:** `/animal/no-existe/mapa` lleva al detalle con "Esta publicación no está disponible.".
- **Mi ubicación:**
  - sin permiso, el aviso "No pudimos acceder a tu ubicación…";
  - con permiso, va hasta la posición con zoom 15 y dibuja el punto.
- **Consola:** sin errores (salvo los de red de OpenFreeMap, más abajo).

**Computadora (1366 × 860) y tablet (820 × 1000):**
- con Tab se llega al mini mapa, con foco visible (2 px sólido), y Enter lo abre;
- en amplio, la tarjeta va abajo a la izquierda (420 de ancho) y el mapa empieza después del riel (88);
- la rueda del mouse acerca (16,25 → 17,68) y arrastrar con el mouse mueve el mapa;
- sin errores.

Las capturas en claro, oscuro, computadora y tablet se miraron una por una. En este entorno no hay red a OpenFreeMap: las capturas no tienen calles. Los números se ven igual: MapLibre los dibujó sin la fuente de OpenFreeMap. En producción usan Noto Sans Bold, como los números de los clusters.

### Peso

Build de producción (`npx expo export -p web`), los `<script>` de `index.html`. Antes: `main` en `bb559b3`.

| | Antes | Después | Diferencia |
| --- | --- | --- | --- |
| Carga inicial, sin comprimir | 1.782.608 | 1.783.089 | +481 (+0,03 %) |
| Carga inicial, gzip -9 | 474.785 | 474.896 | +111 (+0,02 %) |
| `mapasWeb` (MapLibre, aparte), sin comprimir | 1.097.445 | 1.108.447 | +11.002 |
| `mapasWeb`, gzip -9 | 289.772 | 293.012 | +3.240 |
| Ruta `animal/[id]/mapa` (nueva, aparte) | — | 9.404 (4.183 gzip) | — |

Lo que el navegador baja al abrir cada ruta por primera vez (Chromium, gzip como Vercel, sin MapLibre):

| Ruta | Antes | Después | Diferencia |
| --- | --- | --- | --- |
| `/` | 491.535 | 491.753 | +218 (+0,04 %) |
| `/animal/a1` | 503.315 | 503.908 | +593 (+0,1 %) |

**De dónde sale lo que suma a la carga inicial** (mapas de fuentes de los dos builds, módulo por módulo):
- **`__common`, +330 bytes:** solo `es-UY.ts` (+318), donde por regla viven los textos.
- **`entry`, +151 bytes:** el registro de la ruta nueva.
- **No entra ningún módulo nuevo en `__common`.** `recorrido.ts` va solo en la ruta nueva; `encuadre.ts`, `contraste.ts` y las capas, solo en `mapasWeb`.
- **El detalle crece con el botón del mini mapa,** que está en su propio bloque.

## 4. Pasos manuales

- **Supabase:** nada. No hay migración ni cambio de permisos.
- **Vercel:** nada. La ruta nueva sale en el build de siempre.
- **GitHub:** este commit no se subió, porque el pedido fue un solo commit sin push. Cuando lo apruebes:
  ```bash
  git push -u origin claude/animales-repo-mxm2ja
  ```
  Después, abrir el PR contra `main`.
- **Con el deploy:** recorrer el flujo 25 de `docs/PRUEBAS-MANUALES.md` en Android, iPhone y computadora, entre el 17 y el 18, con Toby resguardado.

## 5. Pendientes y riesgos

- **Gestos en celulares reales:** no se probaron en Chrome de Android ni en Safari de iPhone. Chromium con toque simulado no hace "tirar para recargar" ni el gesto de Atrás del borde. Lo cubren `touch-action: none` en el canvas y `overscroll-behavior-y: none` en la página, pero hay que confirmarlo con el flujo 25.
- **Versión nativa sin probar:**
  - `MapaRecorridoGrande.tsx` compila y sigue la API de MapLibre React Native v11, pero no hay build nativo;
  - en el mini mapa del detalle, que el toque llegue al botón depende de `pointerEvents: 'none'` sobre el mapa.
- **Zonas de más:** se dibujan como zona también los resguardos de antes de la 0013 (guardados exactos) y un resguardo sin "¿Dónde está ahora?", que repite el último punto. Es a propósito: mostrar de más como zona no expone nada.
- **Puntos en el mismo lugar:** los números se enciman. Arriba va el elegido o el más nuevo. Para recorrerlos están Anterior y Siguiente; tocar ahí elige uno solo.
- **La vista inicial se calcula una vez,** con el tamaño de la tarjeta del último punto. Si se gira el celular o la tarjeta de otro punto es más alta, no se vuelve a encuadrar. Anterior y Siguiente sí usan el alto del momento.
- **Entrar directo a `/animal/<id>/mapa`** (recargar ahí) no adelanta los datos con `precarga.ts`, que sigue cubriendo solo los links que se comparten (`/animal/<id>`).
- **La prueba del navegador lee el mapa por dentro:** toma la instancia de MapLibre desde las refs de React, solo para medir zoom y posiciones. No hay ganchos de prueba en el código de la app.
- **Siguen los pendientes de `docs/reportes/2026-10-20-mejoras.md`:**
  - el ícono de la plantilla de Expo;
  - no hay borrado automático de reportes ni de capturas;
  - el arrastre de la hoja no se probó en un iPhone real.

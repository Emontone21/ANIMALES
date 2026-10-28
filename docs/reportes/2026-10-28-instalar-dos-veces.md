# "Instalar la app" aparecía dos veces en Perfil · 2026-10-28

## 1. Resumen

**Qué se pidió:** a algunas personas, en Perfil, les aparecía dos veces el botón "Instalar la app".

**La causa:** en Perfil → La app hay dos piezas que ofrecían el mismo botón:
- **El interruptor "Notificaciones en este celular"** (`InterruptorAvisos`, en `AvisosCelular.tsx`): en iPhone y iPad sin la app instalada explica que las notificaciones llegan con la app instalada y traía su propio "Instalar la app".
- **El botón "Instalar la app" de Perfil** (`formaDeInstalar`, en la forma `pasosIos`).

Los dos abrían la misma hoja. Por eso lo veían quienes entran **con cuenta desde Safari en iPhone o iPad, sin la app instalada**. En los navegadores de WhatsApp, Instagram y Facebook pasaba lo mismo con otro texto: "Abrir en Chrome o Safari" y "Instalar la app", que llevan a la misma hoja.

**Qué se hizo:**
- **En Perfil, el interruptor sigue explicando qué hacer, pero sin botón propio.** El botón es "Instalar la app" de Perfil, justo debajo, que abre la misma hoja.
- **La pregunta después de publicar no cambia:** ahí no hay otro botón, así que conserva el suyo.
- **Una prueba fija la regla:** en todos los casos en que el interruptor explicaría que hay que instalar o abrir en el navegador, el botón de Perfil está y abre la hoja que corresponde.

## 2. Cambios

- `src/components/notificaciones/AvisosCelular.tsx`:
  - `ComoActivarlas` dibuja su botón solo si recibe `onHoja`;
  - `InterruptorAvisos` (Perfil) no se lo pasa y ya no tiene su propia hoja;
  - `OfertaAvisos` (después de publicar) sigue igual.
- `__tests__/formaDeAvisar.test.ts`: "en Perfil, un solo botón para instalar o abrir en el navegador". Para iPhone en Safari, un iPad que dice ser una Mac, WhatsApp en Android e Instagram en iPhone comprueba dos cosas:
  - que el interruptor queda en `instalarPrimero` o `abrirEnNavegador`;
  - que Perfil muestra su botón con la hoja que corresponde (`pasosIos` o `abrirEnNavegador`).
- `docs/DISENO.md`, 6.17: el interruptor de Perfil explica sin botón; el botón es "Instalar la app".
- `docs/PRUEBAS-MANUALES.md`, paso 30: en Perfil, un solo botón.
- `docs/reportes/2026-10-28-instalar-dos-veces.md`: este reporte.

## 3. Verificaciones

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos (solo el aviso de `synckit` de Node, de siempre). |
| `npm run test` | 33 suites y 362 pruebas, todas pasan (4 nuevas). |
| `npx expo export -p web` | Termina bien. |

**En el navegador (Chromium, tamaño de teléfono):**
- **Cómo se armó:** el build de `main` y el de esta rama, los dos con una clave VAPID de prueba (sin ella el interruptor no aparece), contra el Supabase simulado.
- **Qué se hizo en cada uno:** ingresar con una cuenta, abrir **Perfil** y contar los botones.

| Navegador | Antes (`main`) | Ahora |
|---|---|---|
| iPhone, Safari, sin instalar | "Instalar la app" **2 veces** | "Instalar la app" 1 vez; abre "Agregala a tu pantalla de inicio" |
| WhatsApp (Android) | "Abrir en Chrome o Safari" y "Instalar la app" | "Instalar la app" 1 vez; abre "Abrila en Chrome o Safari" |

## 4. Pasos manuales

Nada que configurar. Después del deploy, en un iPhone con Safari, con cuenta y sin la app instalada: **Perfil → La app** tiene que mostrar la explicación de las notificaciones y un solo **Instalar la app** (paso 30 de `docs/PRUEBAS-MANUALES.md`).

## 5. Pendientes y riesgos

- **El texto del iPhone termina en "Instalala y activalas desde Perfil".** En Perfil se lee un poco redundante, pero sirve igual para la pregunta después de publicar, donde sí hace falta. No se cambió para no tocar textos.
- **En Android con Chrome** no había duplicado: ahí el interruptor se puede prender directo, sin instalar, y no muestra botón de instalar.

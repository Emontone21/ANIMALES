# Cierre de la Fase 6 · 2026-10-19

## 1. Resumen

**Qué se pidió.** Cerrar la Fase 6, con el código de la rama `claude/animales-repo-mxm2ja` (`68c5a05`) ya revisado y aprobado, en este orden:
1. Aplicar en Supabase la 0009 y después la 0010, en ejecuciones separadas, y registrar cada una en el historial.
2. Correr en la base real el script de pruebas de la sección 3 de `2026-10-19-perdidos.md`.
3. Cargar a Toby, el perdido de demo.
4. Escribir este reporte, commitearlo y subir la rama.
5. Abrir el PR contra `main` si no existe y mergearlo con merge commit (esta vez autorizado).
6. Confirmar que el deploy de producción del merge quede en READY.

**Qué se hizo** (pasos 1 a 3, en el proyecto Supabase `bwqvuttuodwypwxckxgf`):
- **Paso 1:** 0009 y 0010 aplicadas y registradas, cada una en su propia ejecución. El historial queda de `20261017000001` a `20261019000010`: 10 filas, 10 versiones distintas.
- **Paso 2:** el script pasó entero (21 pruebas) y no dejó datos. Supabase dejó insertar en `storage.objects` sin problema.
- **Paso 3:** Toby quedó cargado como perdido, con la ubicación redondeada.

Los pasos 5 y 6 se hacen después de este commit. Su resultado va en el mensaje final de la sesión.

## 2. Cambios

**En el repo:**

| Archivo | Por qué |
|---|---|
| `docs/reportes/2026-10-19-cierre-fase-6.md` | Este reporte. No hay cambios de código. |

**En Supabase**, proyecto `bwqvuttuodwypwxckxgf`. Cada paso fue un pedido a la API de administración. Un pedido con varias sentencias es atómico: si algo fallaba, no quedaba nada aplicado.

**Paso 1 · migraciones.**
- **Antes:**
  - historial de `20261017000001` a `20261019000008`, 8 filas;
  - `tipo_avistamiento` = `encontrado, visto, resguardado`;
  - no existían el tipo `tipo_reporte` ni las columnas nuevas de `animales`.
- **0009:** se ejecutó el archivo tal como está en `68c5a05`, comparado byte a byte con el de la rama. En el mismo pedido se insertó `('20261019000009', 'tipo_avistamiento_perdido')` en `supabase_migrations.schema_migrations`. Después, `tipo_avistamiento` = `encontrado, visto, resguardado, perdido`.
- **0010:** en un pedido aparte, igual que la anterior, con `('20261019000010', 'reportes_perdidos')`.
- **Comprobado después de la 0010:**
  - `animales` tiene `tipo_reporte`, `nombre` y `contacto_familia`, y los 3 animales existentes quedaron como `encontrado`;
  - `animales_detalle` tiene `perdido_desde`;
  - `publicar_animal` existe una sola vez, con `p_tipo`, `p_nombre` y `p_contacto_familia`, y es `security definer`;
  - `authenticated` no puede ejecutar `es_foto_propia`;
  - `guardar_embedding` usa `operator(extensions.<=>)`.
- **Historial final:** 10 filas y 10 versiones distintas, de `20261017000001_base` a `20261019000010_reportes_perdidos`, sin duplicados.

**Paso 2 · script de pruebas.**
- Es el script de la sección 3 de `2026-10-19-perdidos.md`, extraído del reporte en `68c5a05` y comparado byte a byte con el que se validó en local.
- Corrió sobre la base real y terminó sin errores: pasaron las 21 pruebas.
  - **Publicación:** redondeo y fotos propias.
  - **Sugerencias:** no hay perdido con perdido, se respeta la regla de 1 día y la familia recibe el aviso con el nombre.
  - **Coincidencias:** quién confirma, el principal y el resguardo heredado.
  - **Cierre:** quién cierra un perdido y un encontrado.
- **Control:** para descartar que la API devolviera vacío sin ejecutar, corrí además una copia con una expectativa cambiada a propósito, `-34.999` en vez de `-34.915`. Falló como debía: `FALLA 1: la ubicación del perdido no se redondeó (-34.915 , -56.168)`. Eso muestra que el script corre de verdad en producción y que ahí publicar un perdido redondea la ubicación.
- **`storage.objects`:** Supabase dejó insertar las fotos de prueba sin problema.
- **No dejó datos.** Conteos antes y después del script y del control:

  | | usuarios | perfiles | moderadores | animales | avistamientos | cambios_estado | coincidencias | notificaciones | seguimientos | cola_vision | storage.objects | pedidos pg_net |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Antes | 1 | 1 | 0 | 3 | 4 | 0 | 0 | 0 | 3 | 4 | 0 | 0 |
  | Después | 1 | 1 | 0 | 3 | 4 | 0 | 0 | 0 | 3 | 4 | 0 | 0 |

  Además: 0 usuarios `@encontrados.test`, 0 fotos de prueba y ninguna transacción abierta (`idle in transaction`).

**Paso 3 · Toby.**
- Se ejecutó solo el último bloque de `supabase/seed.sql` en `68c5a05`, desde el comentario "Perro perdido a unos 300 m…".
- Antes se comprobó que la cuenta demo existía y que Toby no estaba cargado.
- **Resultado:**
  - `animales_mapa` muestra a Toby como `perdido` y `avistado`, en `-34.9130, -56.1660`, con el contacto "Escribinos por la app";
  - el primer avistamiento es de tipo `perdido` y `animales_detalle` trae `perdido_desde`;
  - la cuenta demo lo sigue, por el trigger de seguir al publicar;
  - su foto quedó en `cola_vision`. No salió ningún aviso al servicio de visión porque `vision_url` está vacío.
- **Conteos nuevos:** 4 animales, 5 avistamientos, 4 seguimientos y 5 en `cola_vision`.

## 3. Verificaciones

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK (exit 0) |
| `npm run lint` | OK (exit 0), sin advertencias con `eslint src --max-warnings 0` |
| `npx expo export -p web` | OK, `Exported: dist` (exit 0) |

**Sin verificar desde esta sesión:**
- la web publicada: la red bloquea `*.vercel.app`;
- el login de la cuenta demo: la red bloquea `*.supabase.co`.

Las reglas se verificaron directo en la base (paso 2).

## 4. Pasos manuales

1. **Probar la Fase 6 en la web publicada**, cuando el deploy del merge esté en READY. Seguí "Cómo probar → Fase 6" del README. Toby tiene que verse en el mapa con anillo y halo naranja, cerca del perro de Parque Rodó.
2. **Servicio de visión**, para que aparezcan coincidencias. Seguí los pasos de "Servicio de visión en Hugging Face" de `2026-10-19-perdidos.md`, sección 4. La 0010 ya está aplicada, así que `guardar_embedding` ya funciona. Hay 5 fotos esperando en la cola: las 4 de antes y la de Toby. Con Toby y el perro de Parque Rodó, que usan la misma foto, tiene que aparecer una coincidencia, y la cuenta demo tiene que recibir "Encontraron un animal parecido a Toby".
3. **Sigue pendiente del rediseño:** confirmar en Vercel que `EXPO_PUBLIC_MAP_STYLE_URL` no apunte a Liberty.

## 5. Pendientes y riesgos

- **Ventana de despliegue.** Las migraciones ya están en producción y el merge todavía no. Mientras tanto, la app publicada sigue con el código anterior, que funciona con la base nueva: los parámetros nuevos de `publicar_animal` tienen default y las vistas solo suman columnas.

  La diferencia es en las coincidencias. La app vieja le muestra "Es el mismo animal" a cualquiera y la base rechaza a quien no corresponde. Hoy no hay ninguna coincidencia, así que no afecta a nadie.
- **Script de permisos de la Fase 5** (`2026-10-19-correcciones.md`): corta en su prueba 5 por la validación de fotos. Es lo esperado; en `2026-10-19-perdidos.md` está la línea para adaptarlo.
- **Seguimos de antes:**
  - `supabase/seed.sql` tiene la contraseña pública `demo1234` para bases nuevas (en producción ya se cambió);
  - tokens de push que quedan a nombre del usuario anterior en un teléfono compartido (solo app nativa);
  - tres denuncias de cuentas nuevas alcanzan para ocultar una publicación (Fase 7).

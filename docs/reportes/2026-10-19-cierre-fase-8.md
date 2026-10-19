# Cierre de la Fase 8 · 2026-10-19

## 1. Resumen

**Qué se pidió.** Cerrar la Fase 8, con el código de la rama `claude/animales-repo-mxm2ja` (`7b3693e`) ya revisado y aprobado, en este orden:
1. Aplicar la 0012 en Supabase y registrarla en el historial, que tiene que quedar de 0001 a 0012 sin duplicados.
2. Correr en la base real, de a uno, `fase5_permisos.sql`, `fase6_perdidos.sql`, `fase7_cuenta.sql` y `fase8_casos.sql`, sin errores y sin dejar datos, con el mismo control de la Fase 7.
3. Escribir este reporte, commitearlo y subir la rama.
4. Mergear el PR con merge commit (autorizado).
5. Confirmar que el deploy de producción del merge quede en READY, con la función `api/vista-previa` y el preset en Other.

**Qué se hizo** (pasos 1 y 2, en el proyecto Supabase `bwqvuttuodwypwxckxgf`):
- **Paso 1:** 0012 aplicada y registrada. Historial de `20261017000001_base` a `20261019000012_gestion_de_casos`: 12 filas, 12 versiones distintas.
- **Paso 2:** los cuatro scripts terminaron sin errores y sin dejar datos. Las cuatro copias de control fallaron donde debían; la de la Fase 8, en su última comprobación.

Los pasos 4 y 5 se hacen después de este commit. Su resultado va en el mensaje final de la sesión.

## 2. Cambios

### En el repo

| Archivo | Por qué |
|---|---|
| `docs/reportes/2026-10-19-cierre-fase-8.md` | Este reporte. No hay cambios de código. |

### En Supabase

Proyecto `bwqvuttuodwypwxckxgf`. Cada paso fue un pedido a la API de administración. Un pedido con varias sentencias es atómico: si algo fallaba, no quedaba nada aplicado. Corrieron como `postgres`, igual que el SQL Editor.

**Paso 1 · migración 0012.**
- **Antes:**
  - historial de `20261017000001_base` a `20261019000011_cuenta_y_proteccion`: 11 filas, 11 versiones distintas;
  - no existía ninguna función de la 0012, y `limpiar_cuenta` todavía tenía su propia lógica de borrado.
- **Aplicación:** un solo pedido con el archivo tal como está en `7b3693e`, comparado byte a byte con el de la rama, y al final:
  ```sql
  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261019000012', 'gestion_de_casos');
  ```
  Respondió sin errores.
- **Comprobado después:**
  - existen `raiz_foto`, `arbol_de_casos`, `borrar_casos`, `reporte_propio`, `editar_reporte`, `fotos_del_reporte` y `borrar_reporte`, cada una con una sola firma; todas `security definer` menos `raiz_foto`, que no lee tablas;
  - `authenticated` ejecuta `editar_reporte`, `fotos_del_reporte` y `borrar_reporte`, y no las internas (`borrar_casos`, `reporte_propio`, `arbol_de_casos`); `anon` no ejecuta ninguna;
  - `limpiar_cuenta` usa `borrar_casos`, y `fotos_para_borrar` compara por `raiz_foto`;
  - `raiz_foto('u/abc.miniatura.jpg')` es igual a `raiz_foto('u/abc.jpg')`.
- **Historial final:** 12 filas y 12 versiones distintas, de `20261017000001_base` a `20261019000012_gestion_de_casos`, sin duplicados.

**Paso 2 · pruebas.**
- Los cuatro archivos se compararon byte a byte con `7b3693e` y se corrieron de a uno, cada uno en su propio pedido. Los cuatro terminaron sin errores.
- **Control:** la API devuelve lo mismo cuando un script pasa y cuando no corre, así que corrí una copia de cada uno con una expectativa cambiada a propósito. Las de las fases 5 a 7 son las mismas del cierre de la Fase 7 (esos scripts no cambiaron); la de la Fase 8 cambia la última comprobación (14 fotos por 15). Las cuatro fallaron donde debían:

  | Copia de | Error |
  |---|---|
  | `fase5_permisos.sql` | `FALLA 4: no pudo marcar como leído un mensaje recibido` |
  | `fase6_perdidos.sql` | `FALLA 14b: el moderador no pudo rechazar` |
  | `fase7_cuenta.sql` | `FALLA 30: un tercero cerró un encontrado anónimo` |
  | `fase8_casos.sql` | `FALLA 15b: fotos_para_borrar(false) no devolvió las 14 fotos de P` |

  La 15b es la última comprobación del script de la Fase 8: que llegue hasta ahí prueba que todo lo anterior pasó en producción, también editar, borrar un caso con todo lo que tiene y las fotos con sus miniaturas.
- **No dejaron datos.** Conteos iguales antes, después de cada script y después de los controles:

  | usuarios | perfiles | animales | avistamientos | cambios_estado | contactos_resguardo | coincidencias | notificaciones | seguimientos | denuncias | bloqueos | conversaciones | mensajes | cola_vision | storage.objects | pedidos pg_net |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 2 | 2 | 4 | 5 | 0 | 0 | 0 | 2 | 4 | 0 | 0 | 1 | 2 | 5 | 0 | 0 |

  Además: 0 usuarios `@encontrados.test` y ninguna transacción abierta (`idle in transaction`). Desde el cierre de la Fase 7 hay un usuario más, una conversación con 2 mensajes y 2 avisos: es uso real de la app, y las pruebas no lo tocaron.

## 3. Verificaciones

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK (exit 0) |
| `npm run lint` | OK (exit 0) |
| `npx expo export -p web` | OK, `Exported: dist` (exit 0) |

Corridas sobre `7b3693e` con este reporte agregado.

**Sin verificar desde esta sesión:**
- la web publicada: la red bloquea `*.vercel.app`;
- la vista previa con un bot real: solo se puede en producción, después del merge (ver sección 4).

## 4. Pasos manuales

1. **Probar la Fase 8 en la web publicada**, cuando el deploy del merge esté en READY. Seguí la Fase 8 de "Cómo probar cada fase" en el README: miniaturas y foto en los marcadores, editar, borrar, compartir y "Ver lista".
2. **Probar la vista previa del link**, también en producción (las previews piden login de Vercel y los bots no entran):
   - **WhatsApp o Telegram:** mandate el link de un caso, por ejemplo el de Toby (`https://animales-blue.vercel.app/animal/b0000000-0000-4000-8000-000000000004`). Antes de enviarlo aparece la tarjeta "Se perdió Toby" con la foto.
   - **Depurador de Facebook:** https://developers.facebook.com/tools/debug/, pegá el link y tocá **Depurar**.
   - **Terminal:**
     ```bash
     curl -s -A "facebookexternalhit/1.1" https://animales-blue.vercel.app/animal/b0000000-0000-4000-8000-000000000004 | grep -E 'og:|twitter:'
     curl -s https://animales-blue.vercel.app/animal/b0000000-0000-4000-8000-000000000004 | grep -c 'og:title'   # 0: las personas reciben la web de siempre
     ```
3. **Sigue pendiente de la Fase 7:** SMTP propio y, después, la plantilla "Reset Password" en español (pasos en `2026-10-19-cierre-fase-7.md`, sección 4).

## 5. Pendientes y riesgos

- **Ventana de despliegue.** La 0012 ya está en producción y el merge todavía no. La app publicada hoy sigue funcionando: la 0012 es toda `create or replace` y no toca tablas. Mientras tanto, si alguien borra su cuenta dejando cosas publicadas, la app vieja no sube miniaturas, así que no hay nada que perder. Cuando llegue el deploy del merge, Editar y Borrar ya encuentran sus funciones.
- **Vista previa a confirmar en producción:** que `vercel.json` mande los bots a la función. El patrón de user-agent se probó en JavaScript y la función ya corrió en un preview con los datos reales de Toby, pero el ruteo de Vercel con `has` solo se ve con un bot de verdad. Si falla, se ve la vista previa genérica de antes; las personas no pasan por la función.
- **Nativo sin probar:** marcadores, hoja de compartir y miniaturas en el celular (ver `2026-10-19-casos.md`).
- **Seguimos de antes:**
  - términos y privacidad en borrador;
  - servicio de visión sin configurar: 5 fotos esperando en `cola_vision`;
  - SMTP propio y plantilla de recuperación en español;
  - tokens de push que quedan a nombre del usuario anterior en un teléfono compartido (solo app nativa).

# Limpieza de los datos de prueba en producción · 2026-10-27

## 1. Resumen

**Qué se pidió:** borrar en producción todas las publicaciones de prueba menos la del perro "Beige, hocico y orejas oscuras", para poner la app en producción.

**Qué se hizo:**
- **Se borraron 8 de los 9 casos** con `borrar_casos`, la función de siempre para borrar casos (la misma de `borrar_reporte` y `limpiar_cuenta`). Fue en una sola transacción y con controles:
  - se cancelaba si faltaba el caso a conservar o si el árbol lo incluía;
  - también si no eran exactamente 8;
  - y si al final no quedaba solo ese caso.
- **Con ellos se fue todo lo que cuelga de un caso:** avisos, cambios de estado, historias del muro, el contacto del resguardo, seguimientos y la cola y las comparaciones de la IA.
- **Queda un solo caso:** el encontrado `e9a1c12a-5025-4ca5-8cc1-7722a45226ee` (perro mediano, "Beige, hocico y orejas oscuras", peatonal Sarandí), con su aviso y su descripción de la IA.
- **Las 27 fotos de los casos borrados siguen en Storage:** desde esta sesión no se llega a la API de Storage, y las fotos no se borran por SQL (`AGENTS.md`). Las tiene que borrar el dueño (sección 4).
- **No se tocaron:** las cuentas, el registro de uso de la IA (`llamadas_ia`), el reporte de error ni `config_app`. No son publicaciones; ver la sección 5.

## 2. Cambios

- `docs/reportes/2026-10-27-limpieza-datos-de-prueba.md`: este reporte.

No hay cambios de código ni migraciones. Todo lo demás fue en la base de producción, por la API de gestión de Supabase.

## 3. Verificaciones

| Comando | Resultado (en `main`, `3a657a0`, más este reporte) |
|---|---|
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos (solo el aviso de `synckit` de Node, de siempre). |
| `npm run test` | 33 suites y 358 pruebas, todas pasan. |
| `npx expo export -p web` | Termina bien. |

**Antes** (solo lectura):
- **9 casos**, todos de la cuenta demo:
  - 6 encontrados abiertos;
  - 1 gato resguardado;
  - 2 perdidos reunidos con su historia en el muro (Lola y Simón).
- **Un solo caso coincide con lo pedido:** `e9a1c12a…`, color "Beige, hocico y orejas oscuras".
- **Todas las claves que apuntan a un caso borran en cascada.** La excepción es `llamadas_ia.avistamiento_id`, que queda en null: el registro de uso no pierde filas.
- **Storage:** 30 archivos, todos en el bucket `fotos` y en la carpeta de la cuenta demo. 3 son del caso a conservar (la foto, su mediana y su miniatura) y 27 de los casos a borrar (9 fotos con sus tres versiones). Ningún avatar ni archivo suelto.
- `notificaciones` vacía.

**El borrado:** `borrar_casos` con los 8 ids, dentro de `begin` y `commit`, con los controles de la sección 1. Terminó sin errores.

**Después:**

| Tabla | Antes | Después |
|---|---|---|
| `animales` | 9 | 1 |
| `avistamientos` | 11 | 1 |
| `cambios_estado` | 3 | 0 |
| `seguimientos` | 9 | 1 |
| `historias_reencuentro` | 2 | 0 |
| `contactos_resguardo` | 1 | 0 |
| `cola_vision` | 10 | 1 |
| `descripciones_ia` | 10 | 1 |
| `comparaciones_ia` | 16 | 0 |
| `storage.objects` | 30 | 30 (ver la sección 4) |

- **Sin cambios:** las demás tablas, entre ellas cuentas, perfiles, `llamadas_ia` (43), `reportes_errores` (1) y `config_app`.
- **El caso que queda:** encontrado, abierto (avistado) y visible.
- **El contador de reencuentros** da 0.
- **`pg_net`:** sin pedidos nuevos y la cola vacía.
- **La cuenta demo, dueña del caso que queda,** ya no tiene la contraseña de `seed.sql`: se comprobó comparando el hash, sin leerla.

## 4. Pasos manuales

**Borrar las 27 fotos de los casos borrados**, desde el panel de Supabase:
1. Andá a **Storage → `fotos` → carpeta `a0000000-0000-4000-8000-000000000001`**. Tiene 30 archivos.
2. **Dejá los 3 que empiezan con `f77edf04-524a-401e-9878-0fe45d17d970`**: son las tres versiones de la foto del caso que queda (`.jpg`, `.mediana.jpg` y `.miniatura.jpg`).
3. **Seleccioná los otros 27 y borralos.**

Para comprobarlo después, en el SQL Editor:

```sql
select count(*) as quedan,
       count(*) filter (where name like 'a0000000-0000-4000-8000-000000000001/f77edf04-524a-401e-9878-0fe45d17d970.%') as del_caso_que_queda
from storage.objects where bucket_id = 'fotos';
-- Tiene que dar 3 y 3.
```

Mientras no se borren, esas fotos siguen en el bucket público: no aparecen en la app, pero se ven con su dirección exacta.

## 5. Pendientes y riesgos

- **Las cuentas siguen todas:** 4 en total, ninguna moderadora.
  - La demo es la dueña del caso que queda.
  - Las otras tres (una de `correo.com.uy` y dos de `gmail.com`) no tienen casos.

  Si son de prueba, se borran desde **Authentication → Users** o desde la app (**Perfil → Borrar mi cuenta**). No se borraron porque no son publicaciones.
- **No hay moderadora.** Antes de abrir al público conviene marcar una cuenta real (`README.md`, paso 9):

  ```sql
  update perfiles set es_moderador = true where id = '<uuid>';
  ```
- **`llamadas_ia` guarda 43 llamadas de prueba** (el costo de la IA en moderación). Si se quiere arrancar de cero:

  ```sql
  delete from public.llamadas_ia;
  ```

  Ninguna otra tabla depende de ella.
- **`reportes_errores` tiene un reporte de prueba.** Se puede resolver o borrar desde moderación.
- **El caso que queda es de la cuenta demo.** Si se quiere que aparezca como de una persona real, hay que publicarlo de nuevo desde esa cuenta.

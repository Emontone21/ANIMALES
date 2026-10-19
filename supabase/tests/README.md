# Pruebas SQL

Un archivo por fase, para correr sobre una base con todas las migraciones aplicadas (hoy, 0001 a 0013):

| Archivo | Qué prueba |
|---|---|
| `fase5_permisos.sql` | Permisos de escritura de un usuario común: no se hace moderador, no escribe historial ni contactos a mano, no edita mensajes ajenos y publica por RPC. |
| `fase6_perdidos.sql` | Perdidos: redondeo de la ubicación, fotos propias, qué coincidencias se sugieren, quién las confirma y quién cierra un caso. |
| `fase7_cuenta.sql` | Términos, perfil, bloqueos, borrado de cuenta (lo que queda anónimo y lo que se borra), denuncias de cuentas nuevas y resguardo de perdidos. |
| `fase8_casos.sql` | Editar y borrar un reporte: solo quien lo publicó, qué se borra con un caso (también los avisos de otras personas y los reportes unidos), qué fotos se borran con sus miniaturas y qué pasa al cambiar la especie. |
| `fase9_revision.sql` | Correcciones de la revisión integral: avisos de coincidencias con bloqueos, con quién se abre una conversación, ubicación del resguardo redondeada, bucket sin listado, aviso al servicio de visión desde la cola, reintentos con espera y coincidencias solo entre casos abiertos y visibles. |

## Cómo correrlas

En el **SQL Editor** de Supabase: pegá el archivo entero y tocá **Run**.
- **Bien:** termina en `Success. No rows returned`.
- **Mal:** aparece un `ERROR` que empieza con `FALLA n:` y dice qué regla no anda.

Con `psql`, contra cualquier base con las migraciones:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase7_cuenta.sql
```

## Qué tienen en común

- Corren entre `begin` y `rollback`: no dejan usuarios, fotos, casos ni mensajes, y se pueden volver a correr.
- Crean personas de prueba con emails `@encontrados.test`, que aceptan la versión vigente de los términos, y fotos de prueba en `storage.objects`, dentro de la transacción.
- Nunca borran filas de `storage.objects`: Supabase no lo permite por SQL.
- `fase9_revision.sql` carga una `vision_url` de prueba y mira los pedidos en `net.http_request_queue`: dentro de la transacción no sale ninguno (pg_net los manda al confirmar, y el script termina en `rollback`).
- Cambian de persona con `request.jwt.claims` y de rol con `set local role`, igual que una llamada desde la app.

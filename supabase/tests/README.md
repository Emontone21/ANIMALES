# Pruebas SQL

Un archivo por fase, para correr sobre una base con todas las migraciones aplicadas (hoy, 0001 a 0018):

| Archivo | Qué prueba |
|---|---|
| `fase5_permisos.sql` | Permisos de escritura de un usuario común: no se hace moderador, no escribe historial ni contactos a mano, no edita mensajes ajenos y publica por RPC. |
| `fase6_perdidos.sql` | Perdidos: redondeo de la ubicación, fotos propias, qué coincidencias se sugieren, quién las confirma y quién cierra un caso. |
| `fase7_cuenta.sql` | Términos, perfil, bloqueos, borrado de cuenta (lo que queda anónimo y lo que se borra), denuncias de cuentas nuevas y resguardo de perdidos. |
| `fase8_casos.sql` | Editar y borrar un reporte: solo quien lo publicó, qué se borra con un caso (también los avisos de otras personas y los reportes unidos), qué fotos se borran con sus miniaturas y qué pasa al cambiar la especie. |
| `fase9_revision.sql` | Correcciones de la revisión integral: avisos de coincidencias con bloqueos, con quién se abre una conversación, ubicación del resguardo redondeada, bucket sin listado, aviso al servicio de visión desde la cola, reintentos con espera y coincidencias solo entre casos abiertos y visibles. |
| `fase9_parte2.sql` | Casos ocultos por moderación y conversaciones (0014): qué ven del caso oculto, sus avistamientos, coincidencias y contactos una persona sin cuenta, otra cuenta, quien lo publicó y moderación; una coincidencia con un lado oculto; conversaciones nuevas rechazadas y las que había, legibles; volver a mostrarlo. Además, quien publicó le escribe a quien lo vio, un tercero no, bloqueos, cuentas borradas y reportes unidos. |
| `errores.sql` | Reportar un error (0015 y 0016): qué se valida con y sin cuenta (largo, contacto solo sin cuenta, captura solo propia y del bucket privado), el límite de 5 por hora por cuenta y el tope sin cuenta, que una persona sin cuenta no ve nada, que solo moderación lee y resuelve (una vez, con aviso a quien lo mandó), quién ve las capturas, los avisos a moderación con bloqueos y qué queda al borrar la cuenta. Usa usuarios propios y cambia el tope sin cuenta solo dentro de la transacción. |
| `vision.sql` | Reconocimiento en Cloud Run (0017): el trabajo de pg_cron cada 2 minutos existe; solo llama al servicio si hay URL y fotos para procesar ahora (no con un error que espera su reintento ni con uno que agotó los intentos); el aviso de una foto y el de vaciar la cola esperan lo que tarda en arrancar; el estado y "Procesar pendientes ahora" son solo de moderación y no dejan ver la URL ni el secreto. Mientras corre, marca como hechas las fotos que ya estaban en la cola (se deshace al terminar). |
| `reconocimiento_ia.sql` | Reconocimiento con la API de Claude (0018): las RPC de la función son solo de `service_role` y `guardar_embedding` ya no se puede usar; los candidatos (misma especie, abiertos y visibles, a menos de 15 km y en la ventana de 60 días, perdido con encontrado o encontrado con encontrado, nunca perdido con perdido ni un encontrado visto mucho antes de la pérdida, sin pares ya comparados ni con coincidencia, sin colores o tamaños claramente incompatibles, sin fotos sin animal, del más cercano al más lejano y hasta `max_candidatos`); cuándo una descripción se compara; guardar la comparación (desde `umbral_ia` crea la coincidencia con confianza, motivo y origen, avisa a la familia e ignora lo que no era candidato); que las descripciones, las comparaciones y el uso los lean solo los moderadores; el tope del día (en hora de Montevideo), el interruptor y la pausa por falta de crédito con Reactivar; tomar una foto una sola vez y soltarla sin gastar un intento. Usa usuarios propios y cambia `config_app` solo dentro de la transacción. |

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
- `fase9_revision.sql`, `vision.sql` y `reconocimiento_ia.sql` cargan una `vision_url` de prueba y miran los pedidos en `net.http_request_queue`: dentro de la transacción no sale ninguno (pg_net los manda al confirmar, y el script termina en `rollback`). pg_net guarda el cuerpo como `bytea`: se lee con `convert_from(body, 'UTF8')::jsonb`.
- Cambian de persona con `request.jwt.claims` y de rol con `set local role`, igual que una llamada desde la app.

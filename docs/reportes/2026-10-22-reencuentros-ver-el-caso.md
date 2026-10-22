# "Ver el caso" del muro, solo para la familia y moderación · 2026-10-22

## 1. Resumen

**Qué se pidió:** el formulario de contar cómo volvió promete "sin tus datos ni dónde fue". Pero en el muro y en `/reencuentros/<id>`, "Más opciones" ofrecía "Ver el caso", que abre el mapa, la zona donde se perdió y los nombres del historial. Había que sacarlo para quien no es la familia ni moderación, con su prueba y el e2e, en el mismo PR (#19), antes del merge.

**Qué se hizo:**
- Las opciones de una historia salen de una regla pura, `opcionesDeHistoria` (`src/features/reencuentros/muro.ts`):
  - para la familia y moderación: "Ver el caso" y "Denunciar la historia";
  - para el resto, con o sin cuenta: solo "Denunciar la historia".
- **Quién es la familia o moderación lo decide la base.** La RLS de `historias_reencuentro` les da la fila solo a ellos. La app la pide al abrir las opciones (`useFamiliaOModeracion`).
  - Sin cuenta no pregunta.
  - Mientras carga, no ofrece "Ver el caso".
- No hizo falta una migración: la 0026 sigue igual.

## 2. Cambios

- `src/features/reencuentros/muro.ts`: `opcionesDeHistoria`, `esDeLaFamiliaOModeracion` y `useFamiliaOModeracion`. Solo los usa el bloque del muro, así que no entran en `__common`.
- `src/features/reencuentros/claves.ts`: la clave `acceso` de esa consulta.
- `src/components/reencuentros/Reencuentros.tsx`: "Más opciones" arma la lista con la regla. Vale para el muro y para la página de una historia; "Cómo volvió" en el caso ya no tenía opciones.
- `__tests__/reencuentros.test.ts`: prueba de la regla. Con la familia o moderación, las dos opciones; si no, solo denunciar.
- `supabase/tests/reencuentros.sql`: FALLA 4h.
  - La familia y la moderadora leen la fila de la historia en la tabla.
  - Quien lo vio, quien lo resguardó, quien le escribió y otra cuenta, no.
- `e2e/flujos.spec.ts` y `e2e/ayudas.ts` (`abrirOpcionesDeHistoria`):
  - la familia ve "Ver el caso" en su historia;
  - sin cuenta no lo ve, ni en el muro ni en el link;
  - la vecina que ayudó tampoco lo ve: la prueba espera a que la base conteste antes de mirar.
- `docs/DISENO.md` (6.19), `docs/ARQUITECTURA.md`, `docs/DECISIONES.md`, `docs/PRUEBAS-MANUALES.md` (paso 32) y `AGENTS.md`: la regla.

## 3. Verificaciones

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos. |
| `npm run test` | 31 suites, 334 pruebas (una más). |
| `npx expo export -p web` | Bien. |
| Pruebas SQL | 13 de 13 en Postgres local con 0001–0026, con la 4h nueva. Con una política que le deja leer la tabla a cualquier cuenta, `reencuentros.sql` falla (la atrapa la 2q, antes que la 4h). |
| e2e contra el build real y el Supabase simulado | Teléfono 20 de 20, computadora 20 de 20. |

## 4. Pasos manuales

Ninguno nuevo. Los de producción son los de la sección 4 de `docs/reportes/2026-10-22-reencuentros.md`: la migración 0026 no cambió.

## 5. Pendientes y riesgos

- **El id de la historia es el del caso.** `/reencuentros/<id>` y `/animal/<id>` usan el mismo `<id>`. Sin el botón, el caso sigue abierto a quien arme el link a mano, y el muro (`muro_reencuentros`) devuelve ese id. Para cerrarlo del todo hacen falta dos cosas:
  - un id propio de la historia, con una columna nueva, una migración y que el muro y la vista previa usen ese id;
  - o que el detalle de un caso reunido no muestre la zona ni el historial a quien no participó.

  No se hizo: es más que el cambio chico pedido.
- La consulta de acceso suma un pedido chico la primera vez que alguien con cuenta abre las opciones de una historia (se guarda 5 minutos).

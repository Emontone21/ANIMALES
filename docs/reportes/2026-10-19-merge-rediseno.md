# Reporte · Merge del rediseño y actualización de Vercel y Supabase

Fecha: 19 de octubre de 2026.

## 1. Resumen

**Qué se pidió.** Mergear el PR del rediseño con merge commit y actualizar Vercel y Supabase para que corran la versión nueva.

**Qué se hizo:**

- **PR [Emontone21/ANIMALES#2](https://github.com/Emontone21/ANIMALES/pull/2)** ("Rediseño visual «Calma oliva»"): antes de mergear verifiqué que no tuviera conflictos y que el deploy de preview de Vercel estuviera listo (estado "Ready"). Se mergeó con merge commit: `b941cb4` en `main`.
- **Supabase:**
  - El rediseño no trae migraciones ni cambios de esquema, así que no hay nada que aplicar.
  - Confirmé por la API de administración que el proyecto `bwqvuttuodwypwxckxgf` tiene aplicadas las 8 migraciones del repo, de `20261017000001_base` a `20261019000008_correcciones`.
  - El proyecto figura como `ACTIVE_HEALTHY`.
- **Vercel:**
  - El proyecto `animales` despliega solo desde GitHub: la preview del PR se construyó sola y quedó lista, y el push a `main` dispara el deploy de producción.
  - No pude confirmar ese deploy ni revisar las variables de entorno: el conector de Vercel responde 403 (sin autorización) para el equipo `busca-labur`, tanto al listar deploys como al leer variables.

## 2. Cambios

- `docs/reportes/2026-10-19-merge-rediseno.md` (este archivo): reporte de la tarea. No hay cambios de código.
- En GitHub: merge commit `b941cb4` en `main` (PR #2).

## 3. Verificaciones

Sobre `main` después del merge (`b941cb4`, mismo árbol que el commit del PR):

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores |
| `npm run lint` | Sin errores ni advertencias |
| `npx expo export -p web` | OK (`Exported: dist`) |

Además:

- Preview de Vercel del PR: "Ready" (`animales-git-claude-animales-repo-mxm2ja-busca-labur.vercel.app`).
- Migraciones en Supabase: 8 de 8 aplicadas.

## 4. Pasos manuales

1. **Volver a autorizar el conector de Vercel** para el equipo `busca-labur`, en la configuración de conectores de claude.ai. Con eso puedo verificar los deploys y las variables yo mismo.
2. **Confirmar el deploy de producción.** En https://vercel.com/busca-labur/animales, el último deploy de Production tiene que ser del commit `b941cb4` y estar en "Ready". Después abrí https://animales-blue.vercel.app y revisá el mapa en claro y en oscuro.
3. **Variable del estilo del mapa.** En Settings → Environment Variables, revisá `EXPO_PUBLIC_MAP_STYLE_URL`:
   - si no existe, no hay que hacer nada: el código usa Positron por defecto;
   - si apunta a `https://tiles.openfreemap.org/styles/liberty`, borrala o cambiala a `https://tiles.openfreemap.org/styles/positron` y hacé Redeploy del último deploy de producción. Las variables `EXPO_PUBLIC_*` se fijan al construir la app.
4. **Supabase:** nada.

## 5. Pendientes y riesgos

- **Producción sin verificar desde acá.** Si el deploy fallara, Vercel deja publicada la versión anterior. La preview del mismo código se construyó bien, así que el riesgo es bajo.
- Siguen abiertos los pendientes del reporte del rediseño (`docs/reportes/2026-10-19-rediseno.md`):
  - mapa con teselas reales;
  - texto grande del sistema y teclado en un celular;
  - Android e iOS;
  - token `velo` para sumar a `DISENO.md`.
- **Dónde quedó este reporte.** No hay cambios de código para acompañarlo, así que va en un commit aparte en la rama `claude/animales-repo-mxm2ja`, recreada desde `main` porque el PR #2 ya está mergeado. Para que llegue a `main` hace falta otro PR.

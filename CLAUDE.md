@AGENTS.md

## Reporte obligatorio
Al terminar cualquier tarea, escribí un reporte en Markdown en
docs/reportes/AAAA-MM-DD-<tema>.md, con la fecha del día, que tenga:
1. Resumen: qué se pidió y qué se hizo.
2. Cambios: cada archivo tocado y por qué.
3. Verificaciones: resultado de npm run typecheck, npm run lint,
   npm run test y npx expo export -p web.
4. Pasos manuales: lo que tiene que hacer el dueño del proyecto en Supabase,
   Vercel u otros servicios, con los comandos o el SQL exactos.
5. Pendientes y riesgos: lo que quedó afuera o conviene revisar.
El reporte va en el mismo commit que los cambios. Terminá mostrando su ruta.

## Ramas y PR
Al terminar cada tarea, subí la rama de trabajo y abrí un PR contra main.
Nunca hagas merge ni push a main.

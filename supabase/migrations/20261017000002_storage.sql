-- =============================================================================
-- 0002 · Storage: bucket público "fotos"
-- Las fotos de animales son públicas por diseño (se ven en el mapa sin cuenta).
-- Cada usuario escribe solo dentro de su carpeta: fotos/<uid>/<archivo>.jpg
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cualquiera puede ver las fotos (bucket público).
create policy "fotos: lectura publica"
  on storage.objects for select
  using (bucket_id = 'fotos');

-- Solo usuarios con cuenta suben, y solo a su propia carpeta.
create policy "fotos: subir a carpeta propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "fotos: actualizar propias"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "fotos: borrar propias"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

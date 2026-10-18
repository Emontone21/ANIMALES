-- =============================================================================
-- 0001 · Esquema base de Encontrados (Fase 1)
-- Extensiones, enums, tablas principales, índices y triggers de mantenimiento.
-- Las políticas RLS viven en 0003.
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.especie as enum ('perro', 'gato', 'otro');
create type public.tamanio as enum ('chico', 'mediano', 'grande');

-- avistado: alguien lo vio suelto · resguardado: alguien lo tiene a salvo
-- reunido: volvió con su familia (caso cerrado) · vinculado: se confirmó que
-- era el mismo animal que otro reporte (ver animales.vinculado_a)
create type public.estado_animal as enum ('avistado', 'resguardado', 'reunido', 'vinculado');

-- encontrado: el reporte inicial · visto: "lo vi acá también" · resguardado:
-- el avistamiento en el que alguien se lo llevó
create type public.tipo_avistamiento as enum ('encontrado', 'visto', 'resguardado');

-- ---------------------------------------------------------------------------
-- Perfiles (1 a 1 con auth.users). Solo datos públicos: nunca email ni teléfono.
-- ---------------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre_publico text not null check (char_length(nombre_publico) between 2 and 40),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.perfiles is 'Datos públicos de cada usuario. El email queda en auth.users y no se expone.';

-- ---------------------------------------------------------------------------
-- Animales: el "caso" de un animal encontrado.
-- ---------------------------------------------------------------------------
create table public.animales (
  id uuid primary key default gen_random_uuid(),
  especie public.especie not null,
  tamanio public.tamanio,
  color text check (char_length(color) <= 80),
  tiene_collar boolean not null default false,
  descripcion text check (char_length(descripcion) <= 1000),
  estado public.estado_animal not null default 'avistado',
  vinculado_a uuid references public.animales (id),
  foto_principal_path text not null,
  creado_por uuid not null references public.perfiles (id) on delete cascade,
  ultimo_avistamiento_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vinculado_coherente check (
    (estado = 'vinculado' and vinculado_a is not null)
    or (estado <> 'vinculado' and vinculado_a is null)
  )
);

comment on column public.animales.foto_principal_path is 'Ruta en el bucket "fotos" (o URL https en datos de demo).';
comment on column public.animales.ultimo_avistamiento_en is 'Denormalizado desde avistamientos para filtrar por antigüedad sin joins.';

create index animales_estado_idx on public.animales (estado);
create index animales_especie_idx on public.animales (especie);
create index animales_ultimo_avistamiento_idx on public.animales (ultimo_avistamiento_en desc);
create index animales_creado_por_idx on public.animales (creado_por);

-- ---------------------------------------------------------------------------
-- Avistamientos: cada vez que alguien vio (o encontró, o resguardó) al animal.
-- El reporte inicial crea un animal + un avistamiento de tipo 'encontrado'.
-- ---------------------------------------------------------------------------
create table public.avistamientos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.tipo_avistamiento not null default 'visto',
  foto_path text,
  ubicacion extensions.geography(point, 4326) not null,
  visto_en timestamptz not null default now(),
  nota text check (char_length(nota) <= 500),
  created_at timestamptz not null default now(),
  constraint foto_obligatoria_si_visto check (tipo = 'resguardado' or foto_path is not null),
  constraint visto_en_no_futuro check (visto_en <= now() + interval '5 minutes')
);

create index avistamientos_animal_idx on public.avistamientos (animal_id, visto_en desc);
create index avistamientos_usuario_idx on public.avistamientos (usuario_id);
create index avistamientos_ubicacion_idx on public.avistamientos using gist (ubicacion);

-- ---------------------------------------------------------------------------
-- Historial de cambios de estado (lo llena la Fase 2; la tabla queda lista).
-- contacto_compartido es lo único que un usuario decide publicar de sí mismo.
-- ---------------------------------------------------------------------------
create table public.cambios_estado (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  estado_anterior public.estado_animal not null,
  estado_nuevo public.estado_animal not null,
  contacto_compartido text check (char_length(contacto_compartido) <= 200),
  nota text check (char_length(nota) <= 500),
  created_at timestamptz not null default now()
);

create index cambios_estado_animal_idx on public.cambios_estado (animal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers de mantenimiento
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

create trigger animales_updated_at
  before update on public.animales
  for each row execute function public.set_updated_at();

-- Al crear un usuario en Auth se crea su perfil público.
-- El nombre sale de user_metadata.nombre_publico, o de la parte local del email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre text;
begin
  nombre := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nombre_publico'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'usuario'), '@', 1)
  );
  nombre := left(nombre, 40);
  if char_length(nombre) < 2 then
    nombre := 'Usuario';
  end if;

  insert into public.perfiles (id, nombre_publico)
  values (new.id, nombre)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cada avistamiento nuevo actualiza la fecha del último avistamiento del animal.
create or replace function public.actualizar_ultimo_avistamiento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.animales
  set ultimo_avistamiento_en = greatest(coalesce(ultimo_avistamiento_en, new.visto_en), new.visto_en)
  where id = new.animal_id;
  return new;
end;
$$;

create trigger avistamientos_actualiza_animal
  after insert on public.avistamientos
  for each row execute function public.actualizar_ultimo_avistamiento();

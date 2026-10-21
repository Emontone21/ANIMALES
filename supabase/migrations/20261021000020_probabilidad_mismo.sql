-- =============================================================================
-- 0020 · Coincidencias de la IA solo con veredicto "mismo" o "posible"
-- El 21/10, en producción, la IA dijo "distinto" con confianza 95 y 98 (qué
-- tan segura estaba de que NO eran el mismo animal) y guardar_comparacion_ia
-- creó tres coincidencias falsas, con aviso a las dos cuentas, porque miraba
-- solo el número.
-- 1. El número pasa a llamarse probabilidad_mismo en lo que manda la función:
--    0 es seguro que no es el mismo animal y 100, seguro que sí. Las columnas
--    confianza de comparaciones_ia y coincidencias guardan ese número.
-- 2. La coincidencia se crea solo si el veredicto es "mismo" o "posible" y la
--    probabilidad llega a umbral_ia. La función ya rechaza las respuestas
--    contradictorias ("distinto" con 50 o más, "mismo" con menos de 50); esto
--    es la segunda barrera.
-- Una función que todavía mande "confianza" no guarda nada: falta
-- probabilidad_mismo y comparaciones_ia no acepta null.
-- Ver docs/DECISIONES.md, "Coincidencias solo con veredicto mismo o posible".
-- =============================================================================

comment on column public.comparaciones_ia.confianza is
  'probabilidad_mismo: de 0 a 100, la probabilidad de que sean el mismo animal (0 seguro que no, 100 seguro que sí).';
comment on column public.coincidencias.confianza is
  'Con origen ia: probabilidad_mismo de la comparación (0 a 100). null en las del servicio de embeddings.';

-- Igual que en la 0018, salvo probabilidad_mismo y el veredicto.
create or replace function public.guardar_comparacion_ia(
  p_avistamiento_id uuid,
  p_resultados jsonb,
  p_modelo text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal uuid;
  v_umbral numeric := public.config_numero('umbral_ia', 70);
  v_creadas integer := 0;
  r jsonb;
  v_otro uuid;
  v_probabilidad smallint;
  v_veredicto text;
  c record;
begin
  select av.animal_id into v_animal from public.avistamientos av where av.id = p_avistamiento_id;
  if v_animal is null then
    raise exception 'Avistamiento inexistente' using errcode = 'P0002';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_resultados, '[]'::jsonb)) loop
    v_otro := (r ->> 'animal_id')::uuid;
    select * into c from public.candidatos_ia_todos(p_avistamiento_id) x where x.animal_id = v_otro;
    if not found then
      continue;
    end if;
    v_probabilidad := (r ->> 'probabilidad_mismo')::smallint;
    v_veredicto := r ->> 'veredicto';

    insert into public.comparaciones_ia (
      animal_a, animal_b, avistamiento_id, confianza, veredicto, motivo, coinciden, difieren, modelo
    )
    values (
      least(v_animal, v_otro),
      greatest(v_animal, v_otro),
      p_avistamiento_id,
      v_probabilidad,
      v_veredicto,
      r ->> 'motivo',
      coalesce((select array_agg(x) from jsonb_array_elements_text(r -> 'coinciden') x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(r -> 'difieren') x), '{}'),
      left(p_modelo, 80)
    )
    on conflict (animal_a, animal_b) do nothing;

    -- "distinto" nunca sugiere, aunque el número sea alto.
    if v_veredicto in ('mismo', 'posible') and v_probabilidad >= v_umbral then
      insert into public.coincidencias (
        animal_origen, animal_candidato, avistamiento_origen, avistamiento_candidato,
        similitud, distancia_m, horas_diferencia, confianza, motivo, origen
      )
      values (
        least(v_animal, v_otro),
        greatest(v_animal, v_otro),
        case when v_animal < v_otro then p_avistamiento_id else c.avistamiento_cercano end,
        case when v_animal < v_otro then c.avistamiento_cercano else p_avistamiento_id end,
        v_probabilidad / 100.0,
        c.distancia_m,
        c.horas,
        v_probabilidad,
        r ->> 'motivo',
        'ia'
      )
      on conflict (animal_origen, animal_candidato) do nothing;
      if found then
        v_creadas := v_creadas + 1;
      end if;
    end if;
  end loop;

  perform public.marcar_hecho_ia(p_avistamiento_id);
  return v_creadas;
end;
$$;

revoke all on function public.guardar_comparacion_ia from public, anon, authenticated;
grant execute on function public.guardar_comparacion_ia to service_role;

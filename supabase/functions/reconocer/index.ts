/**
 * Edge Function "reconocer": el reconocimiento con la API de Claude.
 * config_app.vision_url es su URL (https://<ref>.supabase.co/functions/v1/reconocer).
 *
 * Del entorno: SUPABASE_URL y la clave secreta los pone Supabase;
 * ANTHROPIC_API_KEY es un secreto de la función (supabase secrets set). Ninguna
 * clave en el repo. Ver docs/reportes/2026-10-20-reconocimiento-ia.md.
 */

import { BaseSupabase, claveDesdeEntorno } from './base.ts';
import { crearCliente } from './claude.ts';
import { bajarFoto, ORIGENES_DEMO } from './descargar.ts';
import { crearManejador } from './servidor.ts';

const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const claveApi = (Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim();

Deno.serve(
  crearManejador({
    base: new BaseSupabase(supabaseUrl, claveDesdeEntorno((nombre) => Deno.env.get(nombre))),
    claude: claveApi ? crearCliente(claveApi) : null,
    supabaseUrl,
    // Solo del proyecto (las fotos del bucket) y de los sitios de las fotos de demo.
    bajar: bajarFoto(fetch, {
      origenes: supabaseUrl ? [new URL(supabaseUrl).origin, ...ORIGENES_DEMO] : ORIGENES_DEMO,
    }),
    ahora: () => Date.now(),
    // pg_net espera 150 s a /procesar-pendientes y Supabase corta a los 150 s
    // (plan gratuito): pasados 90 s no se empieza otra foto.
    topeMs: 90_000,
  }),
);

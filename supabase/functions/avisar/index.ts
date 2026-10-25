/**
 * Edge Function "avisar": las notificaciones en el celular (Web Push).
 * config_app.avisar_url es su URL (https://<ref>.supabase.co/functions/v1/avisar).
 *
 * Del entorno: SUPABASE_URL y la clave secreta los pone Supabase;
 * VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son secretos de la función (supabase
 * secrets set) y VAPID_SUBJECT, opcional, el contacto del token. Ninguna
 * clave en el repo. Ver docs/reportes/2026-10-22-avisos-historias.md.
 */

import { BaseSupabase, claveDesdeEntorno } from './base.ts';
import { crearEnviador, importarClaves } from './push.ts';
import { crearManejador } from './servidor.ts';

const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const publica = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
const privada = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
// El sitio de la app: el servicio de push sabe de quién es el envío.
const contacto = (Deno.env.get('VAPID_SUBJECT') ?? '').trim() || 'https://spot-uy.vercel.app';

// Con claves que no son un par, la función contesta 503 y no manda nada.
const claves = publica && privada ? await importarClaves(publica, privada).catch(() => null) : null;

Deno.serve(
  crearManejador({
    base: new BaseSupabase(supabaseUrl, claveDesdeEntorno((nombre) => Deno.env.get(nombre))),
    enviar: claves ? crearEnviador(claves, contacto) : null,
    ahora: () => Date.now(),
    // pg_net espera 30 s (llamar_avisar): pasados 20 s no se toma otra tanda.
    topeMs: 20_000,
  }),
);

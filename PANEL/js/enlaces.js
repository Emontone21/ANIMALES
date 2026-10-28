/**
 * Los links "Abrir en…", armados con los datos no secretos de /api/config.
 * El servidor ya los valida; acá se vuelven a validar antes de ponerlos en un
 * href (nunca un `javascript:` ni otro host). Las rutas del dashboard de
 * Supabase marcadas "a confirmar" en DISEÑO.md salen de acá.
 */

const REF = /^[a-z0-9]{20}$/;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,99}$/;

const HOSTS = {
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  linkedin: ['linkedin.com', 'www.linkedin.com'],
};

/** Pantallas públicas que no dependen de la configuración. */
export const FIJOS = {
  tokensVercel: 'https://vercel.com/account/tokens',
  depuradorMeta: 'https://developers.facebook.com/tools/debug/accesstoken/',
  appsLinkedin: 'https://www.linkedin.com/developers/apps',
};

function https(valor) {
  if (typeof valor !== 'string') return null;
  try {
    const u = new URL(valor);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return u;
  } catch {
    return null;
  }
}

function deHosts(valor, hosts) {
  const u = https(valor);
  return u && hosts.includes(u.hostname.toLowerCase()) ? u.href : null;
}

const slug = (valor) => (typeof valor === 'string' && SLUG.test(valor) ? valor : null);

export function armarEnlaces(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const ref = typeof d.supabaseRef === 'string' && REF.test(d.supabaseRef) ? d.supabaseRef : null;
  const supabase = ref ? `https://supabase.com/dashboard/project/${ref}` : null;
  const equipo = slug(d.vercelEquipo);
  const proyecto = slug(d.vercelProyecto);
  const vercel = equipo && proyecto ? `https://vercel.com/${equipo}/${proyecto}` : null;
  const app = https(d.appUrl)?.origin ?? null;

  return {
    supabase: supabase && {
      proyecto: supabase,
      editor: `${supabase}/editor`,
      usuarios: `${supabase}/auth/users`,
      baseDeDatos: `${supabase}/reports/database`,
      storage: `${supabase}/storage/buckets`,
      funciones: `${supabase}/functions`,
      sql: `${supabase}/sql/new`,
    },
    vercel: vercel && { proyecto: vercel, deploys: `${vercel}/deployments` },
    app: app && { inicio: app, reencuentros: `${app}/reencuentros` },
    facebook: deHosts(d.facebookUrl, HOSTS.facebook),
    instagram: deHosts(d.instagramUrl, HOSTS.instagram),
    linkedin: deHosts(d.linkedinUrl, HOSTS.linkedin),
    fijos: FIJOS,
  };
}

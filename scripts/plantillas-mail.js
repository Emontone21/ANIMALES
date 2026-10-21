/**
 * Arma el cuerpo JSON para cargar las plantillas de mail de supabase/templates/ en el
 * proyecto de Supabase con la API de gestión (PATCH /v1/projects/<ref>/config/auth).
 * Lee los asuntos y los archivos de supabase/config.toml ([auth.email.template.*]).
 *
 *   node scripts/plantillas-mail.js > plantillas.json
 *
 * Los pasos completos están en supabase/templates/README.md.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');

/** Las plantillas de config.toml: { tipo, asunto, archivo }. */
function plantillas() {
  const config = fs.readFileSync(path.join(raiz, 'supabase', 'config.toml'), 'utf8');
  const secciones = config.matchAll(
    /^\[auth\.email\.template\.(\w+)\]\nsubject = "([^"]+)"\ncontent_path = "\.\/([^"]+)"$/gm,
  );
  return [...secciones].map(([, tipo, asunto, archivo]) => ({ tipo, asunto, archivo }));
}

function cuerpo() {
  const json = {};
  for (const { tipo, asunto, archivo } of plantillas()) {
    json[`mailer_subjects_${tipo}`] = asunto;
    json[`mailer_templates_${tipo}_content`] = fs.readFileSync(path.join(raiz, archivo), 'utf8');
  }
  return json;
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(cuerpo(), null, 2)}\n`);
}

module.exports = { plantillas, cuerpo };

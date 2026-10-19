// Regenera src/types/database.ts desde el proyecto de Supabase enlazado
// (npx supabase link). Escribe el archivo solo si el comando anduvo: con
// "supabase gen types … > database.ts", el shell vaciaba el archivo antes de
// que el comando fallara (por ejemplo, sin la CLI o sin proyecto enlazado).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const destino = path.join(__dirname, '..', 'src', 'types', 'database.ts');

let tipos;
try {
  tipos = execFileSync(
    'npx',
    ['supabase', 'gen', 'types', 'typescript', '--linked', '--schema', 'public'],
    // En Windows npx es un .cmd: hace falta el shell.
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], shell: process.platform === 'win32' },
  );
} catch {
  console.error('[db:types] no se pudieron generar los tipos; database.ts quedó como estaba.');
  process.exit(1);
}

if (!tipos.includes('export type Database')) {
  console.error('[db:types] la salida no parece un esquema; database.ts quedó como estaba.');
  process.exit(1);
}
fs.writeFileSync(destino, tipos);
console.log('[db:types] src/types/database.ts actualizado.');

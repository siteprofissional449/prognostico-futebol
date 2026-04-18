/**
 * Lê DATABASE_URL (process.env ou ficheiro .env na raiz) e imprime comandos
 * para definir RAILWAY_PG* — usados por .vscode/settings.json (SQLTools).
 *
 * PowerShell:  node scripts/sqltools-railway-env.js --print-ps1 | Out-File railway-pg.ps1 -Encoding utf8
 *             . .\railway-pg.ps1
 *             cursor .
 *
 * Bash:       eval "$(node scripts/sqltools-railway-env.js --print-sh)"
 */
const fs = require('fs');
const path = require('path');

function loadDatabaseUrlFromDotEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[1].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val || null;
  }
  return null;
}

function parseDatabaseUrl(raw) {
  if (!raw || !String(raw).trim()) {
    throw new Error('DATABASE_URL vazia ou indefinida.');
  }
  const normalized = String(raw).trim().replace(/^postgresql:/, 'postgres:');
  const u = new URL(normalized);
  const database = (u.pathname || '/').replace(/^\//, '').split('?')[0];
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database: database || 'postgres',
  };
}

function ps1Quote(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function shQuote(s) {
  return "'" + String(s).replace(/'/g, `'\\''`) + "'";
}

function main() {
  const mode = process.argv.includes('--print-sh')
    ? 'sh'
    : process.argv.includes('--print-ps1')
      ? 'ps1'
      : 'help';

  if (mode === 'help') {
    console.log(`
Uso:
  node scripts/sqltools-railway-env.js --print-ps1   (PowerShell)
  node scripts/sqltools-railway-env.js --print-sh    (Git Bash / macOS / Linux)

Requer DATABASE_URL no .env ou na variável de ambiente (URL do Railway).
Depois abra o Cursor a partir desse terminal para o SQLTools ler RAILWAY_PG*.
`);
    return;
  }

  const url = process.env.DATABASE_URL?.trim() || loadDatabaseUrlFromDotEnv();
  let parsed;
  try {
    parsed = parseDatabaseUrl(url);
  } catch (e) {
    console.error(e.message);
    console.error(
      'Defina DATABASE_URL no .env ou no ambiente (copie do Railway → Postgres → Variables).',
    );
    process.exit(1);
  }

  if (mode === 'ps1') {
    console.log('$env:RAILWAY_PGHOST=' + ps1Quote(parsed.host));
    console.log('$env:RAILWAY_PGPORT=' + ps1Quote(parsed.port));
    console.log('$env:RAILWAY_PGDATABASE=' + ps1Quote(parsed.database));
    console.log('$env:RAILWAY_PGUSER=' + ps1Quote(parsed.user));
    console.log('$env:RAILWAY_PGPASSWORD=' + ps1Quote(parsed.password));
    return;
  }

  if (mode === 'sh') {
    console.log('export RAILWAY_PGHOST=' + shQuote(parsed.host));
    console.log('export RAILWAY_PGPORT=' + shQuote(parsed.port));
    console.log('export RAILWAY_PGDATABASE=' + shQuote(parsed.database));
    console.log('export RAILWAY_PGUSER=' + shQuote(parsed.user));
    console.log('export RAILWAY_PGPASSWORD=' + shQuote(parsed.password));
    return;
  }
}

main();

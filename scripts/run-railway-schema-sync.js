/**
 * Executa um ficheiro .sql em scripts/ contra DATABASE_URL.
 * Uso: node scripts/run-railway-schema-sync.js [ficheiro.sql]
 * Default: railway-schema-sync.sql
 *
 * Railway / hosts geridos: SSL com rejectUnauthorized: false se DB_SSL estiver ativo
 * ou se o hostname parecer hospedagem na nuvem.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

function envFlag(name) {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function sslForUrl(url) {
  if (envFlag('DB_SSL')) {
    return { rejectUnauthorized: false };
  }
  try {
    const host = new URL(url.replace(/^postgresql:/, 'postgres:')).hostname;
    if (
      /rlwy\.net|railway\.app|render\.com|neon\.tech|supabase\.co/i.test(host)
    ) {
      return { rejectUnauthorized: false };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

async function main() {
  const url =
    process.env.DATABASE_URL?.trim() || loadDatabaseUrlFromDotEnv();
  if (!url) {
    console.error(
      'DATABASE_URL em falta: .env na raiz ou variável de ambiente (Railway → Postgres → Variables).',
    );
    process.exit(1);
  }

  const sqlName = process.argv[2] || 'railway-schema-sync.sql';
  const sqlPath = path.join(__dirname, sqlName);
  if (!fs.existsSync(sqlPath)) {
    console.error('Ficheiro não encontrado: %s', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('--');
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new Client({
    connectionString: url,
    ssl: sslForUrl(url),
  });

  await client.connect();
  try {
    for (const stmt of statements) {
      await client.query(stmt + ';');
    }
  } finally {
    await client.end();
  }

  console.log('Schema sync concluído (%d comandos).', statements.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

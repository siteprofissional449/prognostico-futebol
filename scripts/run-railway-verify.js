/**
 * Confirma tabelas/colunas e resumo de `plans` na DATABASE_URL (Railway).
 * Lê DATABASE_URL do ambiente ou do ficheiro .env na raiz do projeto.
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
      'DATABASE_URL em falta: cola a URL do Railway no .env (DATABASE_URL=...) ou exporta no terminal.',
    );
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, 'railway-verify.sql');
  const full = fs.readFileSync(sqlPath, 'utf8');
  const statements = full
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
    console.log('\n--- Schema (tabelas e colunas) ---\n');
    const r1 = await client.query(statements[0] + ';');
    console.table(r1.rows);

    const allOk = r1.rows.every((row) => row.status === 'OK');
    const hasFail = r1.rows.some((row) => row.status === 'FALTA_TABELA');
    const plansPronto = r1.rows.some(
      (row) => row.nome === 'plans' && String(row.tabela_existe).startsWith('sim'),
    );

    if (plansPronto && statements.length > 1) {
      console.log('\n--- Dados em plans ---\n');
      const r2 = await client.query(statements[1] + ';');
      console.table(r2.rows);
    } else if (statements.length > 1 && !plansPronto) {
      console.log(
        '\n--- Dados em plans --- (omitido: tabela `plans` ainda não existe)\n',
      );
    }

    console.log('');
    if (hasFail) {
      console.log(
        'Resultado: algo falhou — corre railway-init-full.sql ou railway-schema-sync.sql.',
      );
      process.exitCode = 1;
    } else if (!allOk) {
      console.log(
        'Resultado: revisa colunas (status REVISAR_COLUNAS) ou railway-schema-sync.sql.',
      );
      process.exitCode = 1;
    } else {
      console.log('Resultado: schema em ordem (todas as tabelas com colunas esperadas).');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

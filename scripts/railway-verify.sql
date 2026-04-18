-- Confirma schema SmartGol no PostgreSQL (SQLTools: colar e executar na ligação Railway).
-- Compara existência de tabelas e número de colunas com o esperado pelas entidades TypeORM.

SELECT
  nome,
  CASE WHEN existe THEN 'sim' ELSE 'NAO — usar railway-init-full.sql' END AS tabela_existe,
  colunas AS colunas_encontradas,
  esperado AS colunas_esperadas,
  CASE
    WHEN NOT existe THEN 'FALTA_TABELA'
    WHEN colunas >= esperado THEN 'OK'
    ELSE 'REVISAR_COLUNAS'
  END AS status
FROM (
  SELECT
    'plans' AS nome,
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'plans'
    ) AS existe,
    (
      SELECT COUNT(*)::int
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plans'
    ) AS colunas,
    9 AS esperado
  UNION ALL
  SELECT
    'users',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'users'
    ),
    (
      SELECT COUNT(*)::int
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
    ),
    7
  UNION ALL
  SELECT
    'predictions',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'predictions'
    ),
    (
      SELECT COUNT(*)::int
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'predictions'
    ),
    12
  UNION ALL
  SELECT
    'prognostics',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'prognostics'
    ),
    (
      SELECT COUNT(*)::int
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prognostics'
    ),
    10
  UNION ALL
  SELECT
    'generation_meta',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'generation_meta'
    ),
    (
      SELECT COUNT(*)::int
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'generation_meta'
    ),
    3
) AS r
ORDER BY nome;

-- Dados em plans (só faz sentido se a tabela existir; CASE evita erro se ainda não criaste plans)
SELECT
  'plans (linhas)' AS nota,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'plans'
    )
    THEN (SELECT COUNT(*)::int FROM plans)
    ELSE NULL
  END AS total_linhas,
  CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'plans'
    )
    THEN 'tabela ausente'
    WHEN (SELECT COUNT(*) FROM plans) = 0
    THEN 'vazio — normal antes do 1º arranque da API (seed no main.ts)'
    WHEN (SELECT COUNT(*) FROM plans) >= 4
    THEN 'OK — FREE/DAILY/WEEKLY/PREMIUM esperados apos seed'
    ELSE 'poucos registos — verificar seed ou aguardar deploy'
  END AS interpretacao;

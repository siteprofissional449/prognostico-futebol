-- Alinha o PostgreSQL (ex.: Railway) com as entidades TypeORM atuais.
-- Usa quando JÁ existem tabelas mas faltam colunas novas.
-- Base totalmente vazia? Usa railway-init-full.sql (SQLTools ou npm run db:railway-init).
-- Idempotente: pode executar várias vezes.
-- No painel Railway: Postgres → Query → colar tudo e executar.
-- Ou: npm run db:railway-sync (com DATABASE_URL no ambiente)

ALTER TABLE plans ADD COLUMN IF NOT EXISTS "billingPeriod" character varying(16) NOT NULL DEFAULT 'NONE';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "paymentProvider" character varying(32);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "paymentPriceId" character varying(255);

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS "minPlan" character varying NOT NULL DEFAULT 'FREE';

ALTER TABLE prognostics ADD COLUMN IF NOT EXISTS "plan" character varying(16) NOT NULL DEFAULT 'FREE';

ALTER TABLE users ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS generation_meta (
  id character varying(32) NOT NULL,
  "lastPredictionsAt" TIMESTAMP WITH TIME ZONE,
  "lastCount" integer NOT NULL DEFAULT 0,
  CONSTRAINT "PK_generation_meta" PRIMARY KEY (id)
);

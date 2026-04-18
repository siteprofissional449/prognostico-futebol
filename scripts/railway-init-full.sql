-- Schema completo alinhado com as entidades TypeORM (base NOVA / vazia).
-- No SQLTools: New SQL File → colar → Run on active connection (Railway).
-- Idempotente: CREATE TABLE IF NOT EXISTS (não apaga dados; não altera tabelas já existentes).
--
-- Se já tens tabelas antigas só com colunas em falta, usa railway-schema-sync.sql em vez deste.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL,
  name character varying NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  "billingPeriod" character varying(16) NOT NULL DEFAULT 'NONE',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "paymentProvider" character varying(32),
  "paymentPriceId" character varying(255),
  CONSTRAINT "PK_plans" PRIMARY KEY (id),
  CONSTRAINT "UQ_plans_code" UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  "passwordHash" character varying NOT NULL,
  "currentPlanId" uuid,
  "planExpiresAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "isAdmin" boolean NOT NULL DEFAULT false,
  CONSTRAINT "PK_users" PRIMARY KEY (id),
  CONSTRAINT "UQ_users_email" UNIQUE (email),
  CONSTRAINT "FK_users_plans" FOREIGN KEY ("currentPlanId") REFERENCES plans (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS predictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "matchId" character varying NOT NULL,
  "homeTeam" character varying NOT NULL,
  "awayTeam" character varying NOT NULL,
  league character varying NOT NULL,
  "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  market character varying NOT NULL,
  probability numeric(5, 4) NOT NULL,
  odd numeric(5, 2) NOT NULL,
  "minPlan" character varying NOT NULL DEFAULT 'FREE',
  "predictionDate" date NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_predictions" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS prognostics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "homeTeam" character varying NOT NULL,
  "awayTeam" character varying NOT NULL,
  prediction character varying NOT NULL,
  odd double precision NOT NULL,
  "matchDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  status character varying(16) NOT NULL DEFAULT 'PENDING',
  "plan" character varying(16) NOT NULL DEFAULT 'FREE',
  analysis text,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_prognostics" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS generation_meta (
  id character varying(32) NOT NULL,
  "lastPredictionsAt" TIMESTAMP WITH TIME ZONE,
  "lastCount" integer NOT NULL DEFAULT 0,
  CONSTRAINT "PK_generation_meta" PRIMARY KEY (id)
);

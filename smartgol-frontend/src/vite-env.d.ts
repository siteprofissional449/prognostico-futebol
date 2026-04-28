/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública da API (ex.: https://sua-api.onrender.com). Vazio em local = proxy /api. */
  readonly VITE_API_BASE_URL?: string;
  /** DSN do Sentry (opcional). */
  readonly VITE_SENTRY_DSN?: string;
  /** Data “do dia” do app — alinhar com CRON_TZ no Railway (padrão implícito: America/Sao_Paulo). */
  readonly VITE_APP_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

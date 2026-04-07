/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública da API (ex.: https://sua-api.onrender.com). Vazio em local = proxy /api. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

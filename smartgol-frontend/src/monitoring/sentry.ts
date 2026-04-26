import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

export function initSentry() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    tracesSampleRate: 0.1,
  });
}

export function reportError(error: unknown, context?: string) {
  if (!dsn) return;
  Sentry.captureException(error, {
    tags: context ? { context } : undefined,
  });
}

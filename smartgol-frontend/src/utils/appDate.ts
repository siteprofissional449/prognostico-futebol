/** Mesmo conceito que `CRON_TZ` no backend (Railway). Lista de palpites = esta data yyyy-mm-dd. */
const TZ =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.VITE_APP_TIMEZONE?.trim()
    ? String(import.meta.env.VITE_APP_TIMEZONE).trim()
    : 'America/Sao_Paulo';

/** “Hoje” no fuso configurado — evita desvio vs `toISOString()` (UTC no browser). */
export function todayYMDInAppTimezone(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: TZ });
}

/** +/- N dias no calendário a partir de uma string yyyy-mm-dd (meio‑dia UTC). */
export function addCalendarDaysYMD(ymd: string, delta: number): string {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

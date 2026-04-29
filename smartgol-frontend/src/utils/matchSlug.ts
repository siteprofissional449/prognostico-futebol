import type { PredictionView } from '../types';
import { todayYMDInAppTimezone } from './appDate';

const TZ =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.VITE_APP_TIMEZONE?.trim()
    ? String(import.meta.env.VITE_APP_TIMEZONE).trim()
    : 'America/Sao_Paulo';

export type ParsedSlug = {
  homeSlug: string;
  awaySlug: string;
  dateYMD: string;
  /** URL terminou em `-x-...-hoje` — data = hoje na timezone da app */
  variant: 'hoje' | 'dated';
};

/** Normaliza nome de clube para URL (consistente ao gerar e ao resolver slug). */
export function slugifyTeam(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Data yyyy-mm-dd do palpite para o formato da URL DD-MM-AAAA. */
export function dateYmdToDdMmYyyy(ymd: string): string {
  const parts = ymd.trim().slice(0, 10).split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return '';
  return `${pad(d)}-${pad(m)}-${y}`;
}

/** yyyy-mm-dd a partir do palpite */
export function predictionDateYMD(p: PredictionView): string {
  if (p.predictionDate && /^\d{4}-\d{2}-\d{2}/.test(p.predictionDate)) {
    return p.predictionDate.slice(0, 10);
  }
  return new Date(p.startTime).toLocaleDateString('sv-SE', { timeZone: TZ });
}

/** `flamengo-x-palmeiras-28-04-2026` ou `flamengo-x-palmeiras-hoje` → partes válidas ou null */
export function parsePalpiteSlug(slug: string): ParsedSlug | null {
  const hoje = slug.match(/^(.+)-x-(.+)-hoje$/);
  if (hoje) {
    const [, hs, aws] = hoje;
    if (!hs?.length || !aws?.length) return null;
    return {
      homeSlug: hs,
      awaySlug: aws,
      dateYMD: todayYMDInAppTimezone(),
      variant: 'hoje',
    };
  }

  const m = slug.match(/^(.+)-x-(.+)-(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, homeSlug, awaySlug, dd, mm, yyyy] = m;
  const d = Number(dd);
  const mo = Number(mm);
  const y = Number(yyyy);
  if (
    !homeSlug.length ||
    !awaySlug.length ||
    d < 1 ||
    d > 31 ||
    mo < 1 ||
    mo > 12 ||
    y < 2020
  ) {
    return null;
  }
  const dateYMD = `${yyyy}-${pad(mo)}-${pad(d)}`;
  return { homeSlug, awaySlug, dateYMD, variant: 'dated' };
}

export function buildPalpiteSlug(p: PredictionView): string {
  const ymd = predictionDateYMD(p);
  const tail = dateYmdToDdMmYyyy(ymd);
  if (!tail) return '';
  const a = slugifyTeam(p.homeTeam);
  const b = slugifyTeam(p.awayTeam);
  if (!a || !b) return '';
  return `${a}-x-${b}-${tail}`;
}

/** Alias SEO “hoje”: `timea-x-timeb-hoje` (resolver na mesma página que a data atual). */
export function buildPalpiteSlugHoje(p: PredictionView): string {
  const a = slugifyTeam(p.homeTeam);
  const b = slugifyTeam(p.awayTeam);
  if (!a || !b) return '';
  return `${a}-x-${b}-hoje`;
}

import type { PredictionView } from '../types';
import {
  buildPalpiteSlug,
  predictionDateYMD,
  slugifyTeam,
  type ParsedSlug,
} from './matchSlug';

export type { ParsedSlug };

export function predictionMatchesSlug(
  p: PredictionView,
  urlSlug: string,
  parsed: ParsedSlug,
): boolean {
  if (buildPalpiteSlug(p) === urlSlug) return true;
  const ymd = predictionDateYMD(p);
  return (
    slugifyTeam(p.homeTeam) === parsed.homeSlug &&
    slugifyTeam(p.awayTeam) === parsed.awaySlug &&
    ymd === parsed.dateYMD
  );
}

import { api } from './client';
import type { MatchResult, MatchDetail } from '../types';

/** Gera prognósticos na API para uma data (busca jogos na API externa). */
export async function generatePredictionsForDate(date: string): Promise<{ count: number }> {
  return api<{ count: number }>(`/football/generate-today?date=${encodeURIComponent(date)}`, {
    method: 'POST',
  });
}

export async function getResultsOfDay(date?: string): Promise<MatchResult[]> {
  const params = date ? `?date=${date}` : '';
  return api<MatchResult[]>(`/football/results${params}`);
}

export async function getTopLeaguesMatches(date?: string): Promise<MatchResult[]> {
  const params = date ? `?date=${date}` : '';
  return api<MatchResult[]>(`/football/highlights${params}`);
}

export async function getMatchDetail(matchId: number): Promise<MatchDetail | null> {
  return api<MatchDetail | null>(`/football/matches/${matchId}`);
}

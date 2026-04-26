import { api } from './client';
import type { MatchResult, MatchDetail, GenerationInfo, LiveMatchInfo } from '../types';

/** Última geração automática + horário do agendamento (público). */
export async function getGenerationInfo(): Promise<GenerationInfo> {
  return api<GenerationInfo>('/football/generation-info');
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

/** Jogos IN_PLAY/PAUSED (placar ~1 min, cache no backend). */
export async function getLiveMatches(): Promise<{
  items: LiveMatchInfo[];
  refreshedAt: string;
}> {
  return api<{ items: LiveMatchInfo[]; refreshedAt: string }>('/football/live');
}

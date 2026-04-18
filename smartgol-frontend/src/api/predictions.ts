import { api } from './client';
import type {
  PredictionsHistoryResponse,
  PredictionsListResponse,
} from '../types';

export async function getHomePredictions(date?: string): Promise<PredictionsListResponse> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return api<PredictionsListResponse>(`/predictions/home${q}`);
}

/** Lista completa com bloqueio premium para anônimos / tratamento FREE. */
export async function getPublicPredictionsList(date?: string): Promise<PredictionsListResponse> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return api<PredictionsListResponse>(`/predictions/public${q}`);
}

/** Lista autenticada: plano pago vê todos os palpites; FREE igual à pública. */
export async function getMyPredictionsList(date?: string): Promise<PredictionsListResponse> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return api<PredictionsListResponse>(`/predictions${q}`);
}

export async function getPredictionsHistory(
  from?: string,
  to?: string,
): Promise<PredictionsHistoryResponse> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const q = params.toString();
  return api<PredictionsHistoryResponse>(`/predictions/history${q ? `?${q}` : ''}`);
}

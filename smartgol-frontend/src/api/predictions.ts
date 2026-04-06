import { api } from './client';
import type { Prediction } from '../types';
import type { PlanType } from '../types';

export async function getPublicPredictions(
  plan: PlanType = 'FREE',
  date?: string
): Promise<Prediction[]> {
  const params = new URLSearchParams();
  params.set('plan', plan);
  if (date) params.set('date', date);
  return api<Prediction[]>(`/predictions/public?${params}`);
}

export async function getMyPredictions(date?: string): Promise<Prediction[]> {
  const params = date ? `?date=${date}` : '';
  return api<Prediction[]>(`/predictions${params}`);
}

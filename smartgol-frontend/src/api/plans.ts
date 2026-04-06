import { api } from './client';
import type { Plan } from '../types';

export async function getPlans(): Promise<Plan[]> {
  return api<Plan[]>('/plans');
}

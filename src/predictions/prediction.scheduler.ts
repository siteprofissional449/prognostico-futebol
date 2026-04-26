import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PredictionService } from './prediction.service';

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function calendarDateInTimeZone(timeZone: string): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone });
}

@Injectable()
export class PredictionSchedulerService {
  private readonly logger = new Logger(PredictionSchedulerService.name);

  constructor(private readonly predictionService: PredictionService) {}

  /** Gera palpites no mesmo horário; lê a API futebol+odds **em tempo real** (não usa cache de destaques). */
  @Cron('5 0 * * *', {
    timeZone: process.env.CRON_TZ || 'America/Sao_Paulo',
  })
  async runDailyGeneration(): Promise<void> {
    if (envFlag('DISABLE_DAILY_PREDICTION_CRON')) {
      this.logger.debug('Cron diário desativado (DISABLE_DAILY_PREDICTION_CRON).');
      return;
    }
    const tz = process.env.CRON_TZ || 'America/Sao_Paulo';
    const date = calendarDateInTimeZone(tz);
    try {
      const { count } = await this.predictionService.generateDailyPredictions(date);
      this.logger.log(`Cron: geração automática (${date} ${tz}) → ${count} novo(s).`);
    } catch (e) {
      this.logger.error(
        `Cron: geração falhou (${date}): ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

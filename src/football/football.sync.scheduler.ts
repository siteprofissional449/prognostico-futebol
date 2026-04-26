import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FootballService } from './football.service';

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

@Injectable()
export class FootballSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(FootballSyncScheduler.name);

  constructor(private readonly football: FootballService) {}

  onModuleInit(): void {
    void this.football.refreshLiveMatchesFromApi().then(() => {
      this.logger.debug('Cache ao vivo: primeira carga concluída.');
    });
    void this.football.warmScheduleCacheForTodayInTz();
  }

  /**
   * Placar ao vivo: 2 chamadas à API (IN_PLAY + PAUSED) a cada 1 min.
   * Cota ex.: 20 req/min (plano) — fica 18 livres para o resto.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async everyMinuteLive(): Promise<void> {
    if (envFlag('DISABLE_FOOTBALL_LIVE_CRON')) return;
    try {
      await this.football.refreshLiveMatchesFromApi();
    } catch (e) {
      this.logger.warn(
        `Live sync: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /**
   * Renova o cache de destaques/grade (GET /football/highlights) 4x/dia
   * no fuso CRON_TZ. Uma requisição à API por execução.
   */
  /** 00:00, 06:00, 12:00, 18:00 no fuso CRON_TZ. */
  @Cron('0 0,6,12,18 * * *', {
    timeZone: process.env.CRON_TZ || 'America/Sao_Paulo',
  })
  async everySixHoursSchedule(): Promise<void> {
    if (envFlag('DISABLE_FOOTBALL_SCHEDULE_WARM_CRON')) return;
    try {
      await this.football.warmScheduleCacheForTodayInTz();
    } catch (e) {
      this.logger.warn(
        `Schedule warm: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

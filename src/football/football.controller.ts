import { Controller, Get, Param, Query } from '@nestjs/common';
import { FootballService } from './football.service';

@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  /** Última geração de prognósticos + texto do agendamento automático (público). */
  @Get('generation-info')
  async generationInfo() {
    return this.footballService.getGenerationInfo();
  }

  /** Resultados do dia (partidas finalizadas) */
  @Get('results')
  async results(@Query('date') date?: string) {
    const today = new Date().toISOString().slice(0, 10);
    const effectiveDate = date && date === today ? date : today;
    return this.footballService.getResultsOfDay(effectiveDate);
  }

  /** Melhores jogos do mundo (principais ligas no dia) */
  @Get('highlights')
  async highlights(@Query('date') date?: string) {
    return this.footballService.getTopLeaguesMatches(date);
  }

  /** Jogos ao vivo (placar ~1 min; cache alimentado por cron) */
  @Get('live')
  live() {
    return this.footballService.getLiveSnapshot();
  }

  /** Detalhe/estatísticas de um jogo */
  @Get('matches/:id')
  async matchDetail(@Param('id') id: string) {
    return this.footballService.getMatchDetail(parseInt(id, 10));
  }
}

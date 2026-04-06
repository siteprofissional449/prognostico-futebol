import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FootballService } from './football.service';

@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Post('generate-today')
  async generateToday(@Query('date') date?: string) {
    return this.footballService.generateDailyPredictions(date);
  }

  /** Resultados do dia (partidas finalizadas) */
  @Get('results')
  async results(@Query('date') date?: string) {
    return this.footballService.getResultsOfDay(date);
  }

  /** Melhores jogos do mundo (principais ligas no dia) */
  @Get('highlights')
  async highlights(@Query('date') date?: string) {
    return this.footballService.getTopLeaguesMatches(date);
  }

  /** Detalhe/estatísticas de um jogo */
  @Get('matches/:id')
  async matchDetail(@Param('id') id: string) {
    return this.footballService.getMatchDetail(parseInt(id, 10));
  }
}

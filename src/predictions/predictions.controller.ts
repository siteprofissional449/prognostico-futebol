import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { PredictionService } from './prediction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { UsersService } from '../users/users.service';

@Controller('predictions')
export class PredictionsController {
  constructor(
    private readonly predictionsService: PredictionsService,
    private readonly predictionService: PredictionService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Geração manual (mesma lógica do cron). **Apenas administradores** — evita abuso e custo de IA/API.
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('generate-today')
  async generateToday(@Query('date') date?: string) {
    return this.predictionService.generateDailyPredictions(date);
  }

  /** Teaser da home: top 3 jogos por confiança / odd (sempre desbloqueados). */
  @Get('home')
  async listHome(@Query('date') date?: string) {
    return this.predictionsService.listHomeTeasers(date);
  }

  /**
   * Lista pública: comportamento sempre como FREE (não confiar em query plan).
   * Inclui até 5 palpites completos + linhas premium bloqueadas.
   */
  @Get('public')
  async listPublic(@Query('date') date?: string) {
    const access = this.usersService.getPublicAccessContext();
    return this.predictionsService.listWithAccess(access, date);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listForUser(
    @Req() req: { user?: { userId?: string } },
    @Query('date') date?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Usuário não autenticado.');
    const access = await this.usersService.getUserAccessContext(userId);
    return this.predictionsService.listWithAccess(access, date);
  }

  /** Histórico apenas para WEEKLY e MONTHLY. */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async history(
    @Req() req: { user?: { userId?: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Usuário não autenticado.');
    const access = await this.usersService.getUserAccessContext(userId);
    if (!access.canAccessHistory) {
      throw new ForbiddenException(
        'Histórico disponível apenas para planos WEEKLY e MONTHLY.',
      );
    }
    return this.predictionsService.listHistoryWithAccess(access, from, to);
  }
}

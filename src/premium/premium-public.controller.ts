import { Controller, Get, Query } from '@nestjs/common';
import { PremiumService } from './premium.service';

/** Rotas públicas (sem JWT) relacionadas com conteúdo premium/manual. */
@Controller('public')
export class PremiumPublicController {
  constructor(private readonly premiumService: PremiumService) {}

  @Get('manual-prognostics')
  listManualFree(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.premiumService.listFreeManualPrognostics(from, to);
  }
}

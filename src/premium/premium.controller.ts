import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PremiumGuard } from './premium.guard';
import { PremiumService } from './premium.service';

@Controller('premium')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Get('prognostics')
  listPrognostics(
    @Req() req: { user: { plan: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.premiumService.listPrognosticsForPlan(
      req.user.plan,
      from,
      to,
    );
  }
}

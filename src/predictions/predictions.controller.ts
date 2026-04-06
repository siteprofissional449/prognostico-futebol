import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { PlanType } from './prediction.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get('public')
  async listPublic(
    @Query('plan') plan: PlanType = PlanType.FREE,
    @Query('date') date?: string,
  ) {
    return this.predictionsService.findByPlan(plan, date);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listForUser(@Req() req: { user?: { plan?: string } }, @Query('date') date?: string) {
    const plan = (req.user?.plan as PlanType) || PlanType.FREE;
    return this.predictionsService.findByPlan(plan, date);
  }
}

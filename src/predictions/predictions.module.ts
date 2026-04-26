import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prediction } from './prediction.entity';
import { PredictionsService } from './predictions.service';
import { PredictionService } from './prediction.service';
import { PredictionSchedulerService } from './prediction.scheduler';
import { PredictionsController } from './predictions.controller';
import { FootballModule } from '../football/football.module';
import { GenerationMeta } from '../football/generation-meta.entity';
import { UsersModule } from '../users/users.module';
import { AdminGuard } from '../admin/admin.guard';
import { Prognostic } from '../prognostic/prognostic.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prediction, GenerationMeta, Prognostic]),
    forwardRef(() => FootballModule),
    UsersModule,
  ],
  providers: [
    PredictionsService,
    PredictionService,
    PredictionSchedulerService,
    AdminGuard,
  ],
  controllers: [PredictionsController],
  exports: [PredictionsService, PredictionService],
})
export class PredictionsModule {}

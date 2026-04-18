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

@Module({
  imports: [
    TypeOrmModule.forFeature([Prediction, GenerationMeta]),
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

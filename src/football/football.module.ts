import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FootballService } from './football.service';
import { MatchPreMatchAnalysisService } from './match-prematch-analysis.service';
import { FootballController } from './football.controller';
import { FootballSyncScheduler } from './football.sync.scheduler';
import { GenerationMeta } from './generation-meta.entity';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
  imports: [
    forwardRef(() => PredictionsModule),
    TypeOrmModule.forFeature([GenerationMeta]),
  ],
  providers: [FootballService, MatchPreMatchAnalysisService, FootballSyncScheduler],
  controllers: [FootballController],
  exports: [FootballService, MatchPreMatchAnalysisService],
})
export class FootballModule {}

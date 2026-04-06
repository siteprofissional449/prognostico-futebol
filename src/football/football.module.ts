import { Module } from '@nestjs/common';
import { FootballService } from './football.service';
import { FootballController } from './football.controller';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
  imports: [PredictionsModule],
  providers: [FootballService],
  controllers: [FootballController],
})
export class FootballModule {}

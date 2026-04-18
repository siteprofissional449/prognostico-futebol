import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FootballService } from './football.service';
import { FootballController } from './football.controller';
import { GenerationMeta } from './generation-meta.entity';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
  imports: [
    forwardRef(() => PredictionsModule),
    TypeOrmModule.forFeature([GenerationMeta]),
  ],
  providers: [FootballService],
  controllers: [FootballController],
  exports: [FootballService],
})
export class FootballModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prognostic } from '../prognostic/prognostic.entity';
import { PremiumService } from './premium.service';
import { PremiumController } from './premium.controller';
import { PremiumPublicController } from './premium-public.controller';
import { PremiumGuard } from './premium.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Prognostic])],
  controllers: [PremiumController, PremiumPublicController],
  providers: [PremiumService, PremiumGuard],
})
export class PremiumModule {}

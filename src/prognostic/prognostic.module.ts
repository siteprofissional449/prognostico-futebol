import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prognostic } from './prognostic.entity';
import { PrognosticService } from './prognostic.service';
import { PrognosticController } from './prognostic.controller';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Prognostic])],
  controllers: [PrognosticController],
  providers: [PrognosticService, AdminGuard],
})
export class PrognosticModule {}

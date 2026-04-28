import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commercial } from './commercial.entity';
import { CommercialService } from './commercial.service';
import { CommercialPublicController } from './commercial-public.controller';
import { CommercialAdminController } from './commercial-admin.controller';
import { AdminGuard } from '../admin/admin.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Commercial]), UsersModule],
  providers: [CommercialService, AdminGuard],
  controllers: [CommercialPublicController, CommercialAdminController],
  exports: [CommercialService],
})
export class CommercialModule {}

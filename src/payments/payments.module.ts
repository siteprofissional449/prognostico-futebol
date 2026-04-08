import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { MercadoPagoPaymentsService } from './mercadopago-payments.service';
import { UsersModule } from '../users/users.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [UsersModule, PlansModule],
  controllers: [PaymentsController],
  providers: [MercadoPagoPaymentsService],
})
export class PaymentsModule {}

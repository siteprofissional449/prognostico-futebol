import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MercadoPagoPaymentsService } from './mercadopago-payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly mercadoPago: MercadoPagoPaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('mercadopago/checkout')
  async mercadoPagoCheckout(
    @Req() req: { user: { userId: string; email: string } },
    @Body() body: { planCode?: string },
  ) {
    const planCode = body?.planCode?.trim()?.toUpperCase();
    if (!planCode) {
      throw new BadRequestException(
        'Informe planCode: DAILY, WEEKLY ou PREMIUM.',
      );
    }
    return this.mercadoPago.createPreference(
      req.user.userId,
      req.user.email,
      planCode,
    );
  }

  /** Mercado Pago envia notificações por POST (e às vezes query topic=id). */
  @Post('mercadopago/webhook')
  @HttpCode(200)
  async mercadoPagoWebhook(
    @Body() body: unknown,
    @Query() query: Record<string, string>,
  ) {
    await this.mercadoPago.handleWebhook(body, query);
    return { received: true };
  }

  /** Algumas validações de URL do MP usam GET. */
  @Get('mercadopago/webhook')
  @HttpCode(200)
  mercadoPagoWebhookPing() {
    return { ok: true };
  }
}

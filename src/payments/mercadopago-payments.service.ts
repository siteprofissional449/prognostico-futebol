import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PlansService } from '../plans/plans.service';
import { UsersService } from '../users/users.service';

const PAID_PLAN_CODES = ['DAILY', 'WEEKLY', 'MONTHLY', 'PREMIUM'] as const;
type PaidPlanCode = (typeof PAID_PLAN_CODES)[number];

@Injectable()
export class MercadoPagoPaymentsService {
  private readonly logger = new Logger(MercadoPagoPaymentsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly plansService: PlansService,
    private readonly usersService: UsersService,
  ) {}

  private getAccessToken(): string {
    return this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN')?.trim() || '';
  }

  private mpConfig(): MercadoPagoConfig {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new ServiceUnavailableException(
        'Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN).',
      );
    }
    return new MercadoPagoConfig({ accessToken });
  }

  async createPreference(
    userId: string,
    email: string,
    planCode: string,
  ): Promise<{ url: string }> {
    const normalized = planCode.trim().toUpperCase();
    if (!PAID_PLAN_CODES.includes(normalized as PaidPlanCode)) {
      throw new BadRequestException(
        'Plano inválido. Use DAILY, WEEKLY ou MONTHLY.',
      );
    }
    const canonical = normalized === 'PREMIUM' ? 'MONTHLY' : normalized;
    const plan = await this.plansService.findByCode(canonical);
    if (!plan || Number(plan.price) <= 0) {
      throw new BadRequestException('Plano não encontrado ou grátis.');
    }

    const front =
      this.config.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173';
    const apiPublic =
      this.config.get<string>('API_PUBLIC_URL')?.replace(/\/$/, '') || '';

    const externalReference = `sg:${userId}:${canonical}`;
    const preference = new Preference(this.mpConfig());

    const body = {
      items: [
        {
          id: canonical,
          title: plan.name,
          description: plan.description ?? `SmartGol — ${plan.name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(plan.price),
        },
      ],
      payer: { email },
      external_reference: externalReference,
      back_urls: {
        success: `${front}/planos?mp=success`,
        pending: `${front}/planos?mp=pending`,
        failure: `${front}/planos?mp=failure`,
      },
      auto_return: 'approved' as const,
    };

    if (apiPublic) {
      (body as { notification_url?: string }).notification_url = `${apiPublic}/payments/mercadopago/webhook`;
    } else {
      this.logger.warn(
        'API_PUBLIC_URL não definido — webhook do Mercado Pago não será chamado (use ngrok em dev ou URL pública em produção).',
      );
    }

    const result = await preference.create({ body });
    const url = result.sandbox_init_point || result.init_point;
    if (!url) {
      throw new BadRequestException(
        'Não foi possível obter o link de pagamento do Mercado Pago.',
      );
    }
    return { url };
  }

  async handleWebhook(
    body: unknown,
    query: Record<string, string>,
  ): Promise<void> {
    const paymentId = this.extractPaymentId(body, query);
    if (!paymentId) {
      this.logger.debug('Webhook MP sem id de pagamento — ignorado.');
      return;
    }

    const accessToken = this.getAccessToken();
    if (!accessToken) {
      this.logger.warn('Webhook recebido sem MERCADOPAGO_ACCESS_TOKEN.');
      return;
    }

    try {
      const paymentApi = new Payment(this.mpConfig());
      const pay = await paymentApi.get({ id: paymentId });
      if (pay.status !== 'approved') {
        this.logger.log(`Pagamento ${paymentId} status=${pay.status} — sem liberação.`);
        return;
      }

      const ref = pay.external_reference?.trim();
      if (!ref?.startsWith('sg:')) {
        this.logger.warn(`external_reference inválido: ${ref}`);
        return;
      }
      const parts = ref.split(':');
      if (parts.length < 3) return;
      const userId = parts[1];
      const planCode = parts[2] as PaidPlanCode;
      if (!PAID_PLAN_CODES.includes(planCode)) return;
      const canonical = planCode === 'PREMIUM' ? 'MONTHLY' : planCode;
      const plan = await this.plansService.findByCode(canonical);
      if (!plan) return;

      const paid = Number(pay.transaction_amount);
      const expected = Number(plan.price);
      if (Math.abs(paid - expected) > 0.02) {
        this.logger.warn(
          `Valor divergente pagamento ${paymentId}: pago ${paid}, esperado ${expected}`,
        );
        return;
      }

      await this.usersService.grantSubscriptionByPlanCode(userId, canonical);
      this.logger.log(`Plano ${canonical} liberado para usuário ${userId} (pagamento ${paymentId}).`);
    } catch (e) {
      this.logger.error(
        `Erro ao processar webhook MP: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private extractPaymentId(
    body: unknown,
    query: Record<string, string>,
  ): string | undefined {
    if (query?.topic === 'payment' && query?.id) {
      return String(query.id);
    }
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      const data = b.data as Record<string, unknown> | undefined;
      if (data?.id != null) return String(data.id);
      const d = b.resource as string | undefined;
      if (typeof d === 'string' && /^\d+$/.test(d)) return d;
    }
    return undefined;
  }
}

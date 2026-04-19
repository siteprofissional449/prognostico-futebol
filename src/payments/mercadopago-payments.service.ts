import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoConfig,
  Preference,
  Payment,
  MerchantOrder,
} from 'mercadopago';
import { PlansService } from '../plans/plans.service';
import { UsersService } from '../users/users.service';

const PAID_PLAN_CODES = ['DAILY', 'WEEKLY', 'MONTHLY', 'PREMIUM'] as const;
type PaidPlanCode = (typeof PAID_PLAN_CODES)[number];

/**
 * `FRONTEND_URL` pode listar várias origens separadas por vírgula (CORS em `main.ts`).
 * As `back_urls` do Mercado Pago precisam ser uma única URL absoluta; vírgula no meio
 * quebra o host (ex.: `site.vercel.app,https` → DNS inválido).
 */
function primarySiteBaseUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:5173';
  if (!raw?.trim()) return fallback;
  const segments = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (segments.length === 0) return fallback;
  const withScheme =
    segments.find((s) => /^https:\/\//i.test(s)) ??
    segments.find((s) => /^http:\/\//i.test(s));
  if (withScheme) return withScheme;
  const first = segments[0];
  return /^https?:\/\//i.test(first) ? first : `https://${first}`;
}

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

    const front = primarySiteBaseUrl(this.config.get<string>('FRONTEND_URL'));
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
    const accessToken = this.getAccessToken();
    const isTestToken = /^TEST-/i.test(accessToken);
    if (isTestToken) {
      this.logger.warn(
        'MERCADOPAGO_ACCESS_TOKEN começa com TEST- — o Mercado Pago usará Sandbox. Para cobrança real, use o Access Token de produção (aba Credenciais de produção).',
      );
    }
    /** Com token de produção, a API pode devolver os dois links; nunca usar sandbox como fallback (abriria o checkout de testes). */
    let url: string | undefined;
    if (isTestToken) {
      url = result.sandbox_init_point || result.init_point;
    } else {
      url = result.init_point;
      if (!url && result.sandbox_init_point) {
        this.logger.error(
          'Mercado Pago devolveu só sandbox_init_point (sem init_point) com token de produção. No painel MP: Sua integração → Credenciais de produção → complete “Ativar credenciais” (site, ramo, termos).',
        );
        throw new BadRequestException(
          'Pagamento em modo de testes: o Mercado Pago ainda não liberou o link de produção (init_point). No painel de desenvolvedores, ative as credenciais de produção com os dados do negócio e o site.',
        );
      }
    }
    if (!url) {
      throw new BadRequestException(
        'Não foi possível obter o link de pagamento do Mercado Pago.',
      );
    }
    try {
      const host = new URL(url).hostname;
      this.logger.log(
        `Checkout Mercado Pago: host=${host}${host.includes('sandbox') ? ' (ambiente de testes)' : ''}`,
      );
    } catch {
      /* ignore */
    }
    return { url };
  }

  async handleWebhook(
    body: unknown,
    query: Record<string, string>,
  ): Promise<void> {
    const target = this.parseWebhookTarget(body, query);
    if (!target) {
      this.logger.debug(
        'Webhook MP sem payment/merchant_order identificável — ignorado.',
      );
      return;
    }

    const accessToken = this.getAccessToken();
    if (!accessToken) {
      this.logger.warn('Webhook recebido sem MERCADOPAGO_ACCESS_TOKEN.');
      return;
    }

    try {
      if (target.topic === 'merchant_order') {
        await this.grantFromMerchantOrder(target.id);
      } else {
        await this.grantFromPaymentId(target.id);
      }
    } catch (e) {
      this.logger.error(
        `Erro ao processar webhook MP: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /** Checkout Pro costuma notificar `merchant_order`; o `data.id` é da ordem, não do pagamento. */
  private async grantFromMerchantOrder(merchantOrderId: string): Promise<void> {
    const moApi = new MerchantOrder(this.mpConfig());
    const mo = await moApi.get({ merchantOrderId });
    const ref = mo.external_reference?.trim();
    if (!ref?.startsWith('sg:')) {
      this.logger.warn(
        `Ordem MP ${merchantOrderId}: external_reference inválido: ${ref ?? '(vazio)'}`,
      );
      return;
    }
    const approved = (mo.payments ?? []).filter(
      (p) => String(p.status).toLowerCase() === 'approved',
    );
    if (approved.length === 0) {
      this.logger.log(
        `Ordem MP ${merchantOrderId} sem pagamento aprovado (order_status=${mo.order_status ?? 'n/d'}).`,
      );
      return;
    }
    const paidFromOrder = Number(mo.paid_amount ?? 0);
    const sumApproved = approved.reduce(
      (s, p) => s + Number(p.total_paid_amount ?? p.transaction_amount ?? 0),
      0,
    );
    const paidTotal = paidFromOrder > 0.01 ? paidFromOrder : sumApproved;
    await this.grantFromExternalReference(ref, paidTotal, `ordem ${merchantOrderId}`);
  }

  private async grantFromPaymentId(paymentId: string): Promise<void> {
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
    const paid = Number(pay.transaction_amount);
    await this.grantFromExternalReference(ref, paid, `pagamento ${paymentId}`);
  }

  private async grantFromExternalReference(
    ref: string,
    paidAmount: number,
    logLabel: string,
  ): Promise<void> {
    const parts = ref.split(':');
    if (parts.length < 3) return;
    const userId = parts[1];
    const planCode = parts[2] as PaidPlanCode;
    if (!PAID_PLAN_CODES.includes(planCode)) return;
    const canonical = planCode === 'PREMIUM' ? 'MONTHLY' : planCode;
    const plan = await this.plansService.findByCode(canonical);
    if (!plan) return;

    const expected = Number(plan.price);
    if (Math.abs(paidAmount - expected) > 0.02) {
      this.logger.warn(
        `Valor divergente (${logLabel}): pago ${paidAmount}, esperado ${expected} (plano ${canonical}).`,
      );
      return;
    }

    await this.usersService.grantSubscriptionByPlanCode(userId, canonical);
    this.logger.log(
      `Plano ${canonical} liberado para usuário ${userId} (${logLabel}).`,
    );
  }

  /**
   * Consulta pagamentos aprovados no MP por `external_reference` (sg:userId:PLANO)
   * e libera o plano se o webhook não tiver corrido. Útil quando o retorno é `mp=pending`
   * mas o Pix já foi aprovado.
   */
  async syncApprovedPaymentsFromMp(userId: string): Promise<{
    synced: boolean;
    plan: string;
    expiresAt: string | null;
  }> {
    if (!this.getAccessToken()) {
      throw new ServiceUnavailableException(
        'Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN).',
      );
    }
    let synced = false;
    const paymentApi = new Payment(this.mpConfig());
    const codes = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

    for (const code of codes) {
      const ref = `sg:${userId}:${code}`;
      let searchRes: Awaited<ReturnType<Payment['search']>>;
      try {
        searchRes = await paymentApi.search({
          options: {
            external_reference: ref,
            limit: 20,
            sort: 'date_created',
            criteria: 'desc',
          },
        });
      } catch (e) {
        this.logger.warn(
          `sync MP: busca falhou para ${ref}: ${e instanceof Error ? e.message : e}`,
        );
        continue;
      }

      const results = searchRes.results ?? [];
      const plan = await this.plansService.findByCode(code);
      if (!plan || Number(plan.price) <= 0) continue;
      const expected = Number(plan.price);

      const approved = results
        .filter((r) => String(r.status ?? '').toLowerCase() === 'approved')
        .sort((a, b) => {
          const ta = new Date(
            String(a.date_approved ?? a.date_created ?? 0),
          ).getTime();
          const tb = new Date(
            String(b.date_approved ?? b.date_created ?? 0),
          ).getTime();
          return tb - ta;
        });

      for (const r of approved) {
        const paid = Number(r.transaction_amount);
        if (Math.abs(paid - expected) > 0.02) continue;
        await this.usersService.grantSubscriptionByPlanCode(userId, code);
        synced = true;
        this.logger.log(
          `sync MP: plano ${code} liberado para ${userId} (pagamento ${r.id ?? 'n/d'}).`,
        );
        break;
      }
      if (synced) break;
    }

    const access = await this.usersService.getUserAccessContext(userId);
    return {
      synced,
      plan: access.plan,
      expiresAt: access.expiresAt,
    };
  }

  /**
   * IPN antigo: ?topic=payment|merchant_order&id=.
   * Webhook JSON: type + data.id; ou resource como URL.
   */
  private parseWebhookTarget(
    body: unknown,
    query: Record<string, string>,
  ): { topic: 'payment' | 'merchant_order'; id: string } | undefined {
    const qTopic = query?.topic?.toLowerCase();
    const qId = query?.id;
    if (qId && (qTopic === 'payment' || qTopic === 'merchant_order')) {
      return { topic: qTopic, id: String(qId) };
    }

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      const t = String(b.type ?? b.topic ?? '')
        .toLowerCase()
        .trim();
      const data = b.data as Record<string, unknown> | undefined;
      const dataId = data?.id != null ? String(data.id) : undefined;

      if (dataId) {
        if (t === 'payment') {
          return { topic: 'payment', id: dataId };
        }
        if (
          t === 'merchant_order' ||
          t.includes('merchant_order') ||
          t === 'topic_merchant_order_wh'
        ) {
          return { topic: 'merchant_order', id: dataId };
        }
      }

      const resource = b.resource;
      if (typeof resource === 'string') {
        const payUrl = resource.match(/\/payments\/(\d+)/);
        if (payUrl) return { topic: 'payment', id: payUrl[1] };
        const moUrl = resource.match(/\/merchant_orders\/(\d+)/);
        if (moUrl) return { topic: 'merchant_order', id: moUrl[1] };
        if (/^\d+$/.test(resource.trim())) {
          return { topic: 'payment', id: resource.trim() };
        }
      }

      if (dataId && !t) {
        return { topic: 'payment', id: dataId };
      }
    }

    return undefined;
  }
}

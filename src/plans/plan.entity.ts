import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';

export type PlanBillingPeriod = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Valor cobrado a cada período (0 = grátis) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  /** NONE = grátis; demais = ciclo de cobrança para integração com pagamento */
  @Column({ type: 'varchar', length: 16, default: 'NONE' })
  billingPeriod: PlanBillingPeriod;

  /** Ordem na vitrine (menor primeiro) */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** stripe | mercadopago | etc. — preenchido quando integrar checkout */
  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentProvider: string | null;

  /** ID do preço no gateway (ex.: price_xxx Stripe, plan_id MP) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentPriceId: string | null;

  @OneToMany(() => User, (user) => user.currentPlan)
  users: User[];
}

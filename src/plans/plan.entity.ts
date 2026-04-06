import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  /** Valor cobrado a cada período (semana ou mês) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  /** WEEKLY = cobrança a cada 7 dias; MONTHLY = cobrança mensal */
  @Column({ type: 'varchar', length: 16, default: 'MONTHLY' })
  billingPeriod: 'WEEKLY' | 'MONTHLY';

  @OneToMany(() => User, (user) => user.currentPlan)
  users: User[];
}

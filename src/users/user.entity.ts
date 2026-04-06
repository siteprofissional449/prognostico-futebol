import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plan } from '../plans/plan.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  currentPlanId: string | null;

  @ManyToOne(() => Plan, { nullable: true })
  @JoinColumn({ name: 'currentPlanId' })
  currentPlan: Plan | null;

  @Column({ type: 'timestamptz', nullable: true })
  planExpiresAt: Date | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: false })
  isAdmin: boolean;
}

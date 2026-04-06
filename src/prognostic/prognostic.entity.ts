import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum PrognosticStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
}

export enum PrognosticPlan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  VIP = 'VIP',
}

@Entity('prognostics')
export class Prognostic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  homeTeam: string;

  @Column()
  awayTeam: string;

  /** Tipo de palpite / mercado */
  @Column()
  prediction: string;

  @Column({ type: 'double precision' })
  odd: number;

  @Column({ type: 'timestamptz' })
  matchDate: Date;

  @Column({ type: 'varchar', length: 16, default: PrognosticStatus.PENDING })
  status: PrognosticStatus;

  @Column({ type: 'varchar', length: 16, default: PrognosticPlan.FREE })
  plan: PrognosticPlan;

  @Column({ type: 'text', nullable: true })
  analysis: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

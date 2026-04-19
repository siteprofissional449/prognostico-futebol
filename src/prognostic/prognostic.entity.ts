import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum PrognosticStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
}

export enum PrognosticPlan {
  FREE = 'FREE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  PREMIUM = 'PREMIUM',
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

  /** Probabilidade associada ao palpite (0–1), ex. 0,65 = 65%. Opcional. */
  @Column({ type: 'double precision', nullable: true })
  probability: number | null;

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

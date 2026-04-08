import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Nível mínimo para ver um palpite automático (hierarquia crescente). */
export enum PlanType {
  FREE = 'FREE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  PREMIUM = 'PREMIUM',
}

@Entity('predictions')
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  matchId: string;

  @Column()
  homeTeam: string;

  @Column()
  awayTeam: string;

  @Column()
  league: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column()
  market: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  probability: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  odd: number;

  @Column({ type: 'varchar', default: PlanType.FREE })
  minPlan: PlanType;

  @Column({ type: 'date' })
  predictionDate: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

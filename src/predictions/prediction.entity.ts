import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Nível mínimo para ver um palpite automático (hierarquia crescente). */
export enum PlanType {
  FREE = 'FREE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  /** Compatibilidade legada; mapeado ao tier de MONTHLY. */
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

  /** Probabilidades modelo 1X2 (0–1), preenchidas pela geração automática */
  @Column({ type: 'decimal', precision: 6, scale: 4, nullable: true })
  probHome: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 4, nullable: true })
  probDraw: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 4, nullable: true })
  probAway: number | null;

  /** Código do melhor palpite (ex.: HOME_WIN) — espelho legível de `market` */
  @Column({ type: 'text', nullable: true })
  bestBet: string | null;

  @Column({ type: 'text', nullable: true })
  analysis: string | null;

  @Column({ type: 'varchar', default: PlanType.FREE })
  minPlan: PlanType;

  /** Data civil (YYYY-MM-DD) do conjunto de prognósticos */
  @Column({ type: 'date' })
  predictionDate: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

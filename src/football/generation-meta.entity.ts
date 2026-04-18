import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Uma linha: última execução bem-sucedida de geração de prognósticos. */
@Entity('generation_meta')
export class GenerationMeta {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastPredictionsAt: Date | null;

  @Column({ type: 'int', default: 0 })
  lastCount: number;
}

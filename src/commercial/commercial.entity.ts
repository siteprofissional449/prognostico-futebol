import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('commercials')
export class Commercial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** URL HTTPS da imagem (ex.: CDN, Imgur, Supabase Storage). */
  @Column({ type: 'text' })
  imageUrl!: string;

  /** Abre ao clicar na foto (HTTPS). */
  @Column({ type: 'text', default: '' })
  linkUrl!: string;

  @Column({ type: 'varchar', nullable: true })
  title?: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

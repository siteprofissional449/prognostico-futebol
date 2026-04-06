import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Prognostic,
  PrognosticPlan,
  PrognosticStatus,
} from './prognostic.entity';

export interface CreatePrognosticDto {
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  odd: number;
  matchDate: string;
  status?: PrognosticStatus;
  plan?: PrognosticPlan;
  analysis?: string | null;
}

export interface UpdatePrognosticDto {
  homeTeam?: string;
  awayTeam?: string;
  prediction?: string;
  odd?: number;
  matchDate?: string;
  status?: PrognosticStatus;
  plan?: PrognosticPlan;
  analysis?: string | null;
}

@Injectable()
export class PrognosticService {
  constructor(
    @InjectRepository(Prognostic)
    private readonly repo: Repository<Prognostic>,
  ) {}

  async create(dto: CreatePrognosticDto): Promise<Prognostic> {
    const row = this.repo.create({
      homeTeam: dto.homeTeam.trim(),
      awayTeam: dto.awayTeam.trim(),
      prediction: dto.prediction.trim(),
      odd: dto.odd,
      matchDate: new Date(dto.matchDate),
      status: dto.status ?? PrognosticStatus.PENDING,
      plan: dto.plan ?? PrognosticPlan.FREE,
      analysis: dto.analysis?.trim() || null,
    });
    return this.repo.save(row);
  }

  async findAll(): Promise<Prognostic[]> {
    return this.repo.find({ order: { matchDate: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Prognostic> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Prognóstico não encontrado');
    return row;
  }

  async update(id: string, dto: UpdatePrognosticDto): Promise<Prognostic> {
    const row = await this.findOne(id);
    if (dto.homeTeam !== undefined) row.homeTeam = dto.homeTeam.trim();
    if (dto.awayTeam !== undefined) row.awayTeam = dto.awayTeam.trim();
    if (dto.prediction !== undefined) row.prediction = dto.prediction.trim();
    if (dto.odd !== undefined) row.odd = dto.odd;
    if (dto.matchDate !== undefined) row.matchDate = new Date(dto.matchDate);
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.plan !== undefined) row.plan = dto.plan;
    if (dto.analysis !== undefined) {
      row.analysis = dto.analysis === null || dto.analysis === '' ? null : dto.analysis.trim();
    }
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new NotFoundException('Prognóstico não encontrado');
  }
}

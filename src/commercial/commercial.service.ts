import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commercial } from './commercial.entity';

function looksLikeHttpsOrHttp(u: string): boolean {
  const t = u.trim().toLowerCase();
  return t.startsWith('https://') || t.startsWith('http://');
}

function looksLikeImageSource(u: string): boolean {
  const t = u.trim();
  if (looksLikeHttpsOrHttp(t)) return true;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=\s]+$/.test(t);
}

@Injectable()
export class CommercialService {
  constructor(
    @InjectRepository(Commercial)
    private readonly repo: Repository<Commercial>,
  ) {}

  listActivePublic(): Promise<
    Pick<
      Commercial,
      'id' | 'imageUrl' | 'linkUrl' | 'sortOrder' | 'title'
    >[]
  > {
    return this.repo.find({
      where: { active: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
      select: ['id', 'imageUrl', 'linkUrl', 'sortOrder', 'title'],
    });
  }

  async listAll(): Promise<Commercial[]> {
    return this.repo.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(body: {
    imageUrl: string;
    linkUrl: string;
    title?: string | null;
    sortOrder?: number;
    active?: boolean;
  }): Promise<Commercial> {
    const imageUrl = String(body.imageUrl || '').trim();
    const linkUrl = String(body.linkUrl || '').trim();
    if (!imageUrl || !linkUrl) {
      throw new BadRequestException(
        'Campos obrigatórios: URL da imagem e URL do link.',
      );
    }
    if (!looksLikeImageSource(imageUrl) || !looksLikeHttpsOrHttp(linkUrl)) {
      throw new BadRequestException(
        'Imagem deve ser URL http(s) ou data:image base64. Link deve iniciar com https:// ou http://',
      );
    }

    let sortOrder = body.sortOrder;
    if (sortOrder == null || !Number.isFinite(Number(sortOrder))) {
      sortOrder = await this.repo.count();
    } else {
      sortOrder = Math.floor(Number(sortOrder));
    }

    const row = this.repo.create({
      imageUrl,
      linkUrl,
      title: body.title?.trim() || null,
      active: body.active !== false,
      sortOrder,
    });

    return this.repo.save(row);
  }

  async update(
    id: string,
    body: Partial<{
      imageUrl: string;
      linkUrl: string;
      title: string | null;
      sortOrder: number;
      active: boolean;
    }>,
  ): Promise<Commercial> {
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException('Comercial não encontrado.');

    const nextImage = body.imageUrl !== undefined ? String(body.imageUrl).trim() : prev.imageUrl;
    const nextLink = body.linkUrl !== undefined ? String(body.linkUrl).trim() : prev.linkUrl;

    if (!looksLikeImageSource(nextImage) || !looksLikeHttpsOrHttp(nextLink)) {
      throw new BadRequestException(
        'Imagem deve ser URL http(s) ou data:image base64. Link deve iniciar com https:// ou http://',
      );
    }

    if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
      prev.sortOrder = Math.floor(Number(body.sortOrder));
    }
    prev.imageUrl = nextImage;
    prev.linkUrl = nextLink;

    if (body.title !== undefined) {
      prev.title = body.title ? String(body.title).trim() : null;
    }
    if (body.active !== undefined) {
      prev.active = !!body.active;
    }

    return this.repo.save(prev);
  }

  async remove(id: string): Promise<void> {
    const r = await this.repo.delete(id);
    if (!r.affected) throw new NotFoundException('Comercial não encontrado.');
  }
}

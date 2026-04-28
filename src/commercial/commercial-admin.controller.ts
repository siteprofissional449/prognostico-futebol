import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { CommercialService } from './commercial.service';

class CreateCommercialDto {
  imageUrl!: string;
  linkUrl!: string;
  title?: string | null;
  sortOrder?: number;
  active?: boolean;
}

class UpdateCommercialDto {
  imageUrl?: string;
  linkUrl?: string;
  title?: string | null;
  sortOrder?: number;
  active?: boolean;
}

@Controller('admin/commercials')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CommercialAdminController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get()
  list() {
    return this.commercialService.listAll();
  }

  @Post()
  create(@Body() dto: CreateCommercialDto) {
    return this.commercialService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCommercialDto) {
    return this.commercialService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commercialService.remove(id);
  }
}

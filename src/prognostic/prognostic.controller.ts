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
import { PrognosticService } from './prognostic.service';
import type { CreatePrognosticDto, UpdatePrognosticDto } from './prognostic.service';

@Controller('admin/prognostics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PrognosticController {
  constructor(private readonly prognosticService: PrognosticService) {}

  @Post()
  create(@Body() dto: CreatePrognosticDto) {
    return this.prognosticService.create(dto);
  }

  @Get()
  findAll() {
    return this.prognosticService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePrognosticDto) {
    return this.prognosticService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prognosticService.remove(id);
    return { ok: true };
  }
}

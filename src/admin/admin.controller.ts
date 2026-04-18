import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

class AdminUpdateUserDto {
  planCode?: string;
  planExpiresAt?: string | null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats() {
    return this.adminService.getStats();
  }

  @Get('users')
  users() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  /** Apaga todos os prognósticos automáticos de uma data (YYYY-MM-DD). */
  @Delete('predictions')
  clearPredictions(
    @Query('date') date: string,
    @Query('resetMeta') resetMeta?: string,
  ) {
    const flag =
      resetMeta === '1' ||
      resetMeta === 'true' ||
      resetMeta === 'yes' ||
      resetMeta === 'on';
    return this.adminService.clearPredictionsForDate(date, flag);
  }
}

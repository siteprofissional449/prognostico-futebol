import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/plan')
  async getPlan(@Param('id') id: string) {
    const planType = await this.usersService.getUserPlanType(id);
    return { plan: planType };
  }
}

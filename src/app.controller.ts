import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return { message: 'API funcionando' };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}

import { Controller, Get } from '@nestjs/common';
import { CommercialService } from './commercial.service';

/** Endpoints públicos (sem JWT) — apenas leitura. */
@Controller()
export class CommercialPublicController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('commercials/active')
  listActive() {
    return this.commercialService.listActivePublic();
  }
}

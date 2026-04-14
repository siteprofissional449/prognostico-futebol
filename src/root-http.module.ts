import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

/** Rotas públicas na raiz (GET /, GET /health). Módulo separado para registo explícito no grafo Nest (deploy/Railway). */
@Module({
  controllers: [AppController],
})
export class RootHttpModule {}

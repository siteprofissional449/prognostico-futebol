import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlansService } from './plans/plans.service';
import { UsersService } from './users/users.service';

/** Origens permitidas no browser (Vercel). Várias URLs separadas por vírgula. Sem variável: reflete o Origin do pedido (útil em dev / previews). */
function corsOrigin(): true | string | string[] {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return true;
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (list.length === 0) return true;
  return list.length === 1 ? list[0] : list;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Garante nos logs do deploy (ex.: Railway) as linhas "Mapped {/, GET} route" e "/health".
    logger: ['error', 'warn', 'log'],
  });
  app.enableCors({
    origin: corsOrigin(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.get(PlansService).seedPlans();
  await app.get(UsersService).promoteEnvAdmin();

  const listenPort = process.env.PORT ?? '8080';
  // Log explícito: na Railway o "Target port" do domínio público tem de coincidir com este valor.
  console.log(`[bootstrap] PORT=${process.env.PORT ?? '(não definido → 8080)'} → listen 0.0.0.0:${listenPort}`);
  await app.listen(listenPort, '0.0.0.0');
  console.log(`API rodando em http://0.0.0.0:${listenPort}`);
}
bootstrap().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

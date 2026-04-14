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
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigin(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.get(PlansService).seedPlans();
  await app.get(UsersService).promoteEnvAdmin();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`API rodando na porta ${port}`);
}
bootstrap();

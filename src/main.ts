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

  // Railway define PORT; em local usa 8080 se não houver variável.
  const port = Number(process.env.PORT) || 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`API rodando em http://0.0.0.0:${port}`);
}
bootstrap().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

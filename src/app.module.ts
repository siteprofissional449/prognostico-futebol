import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { PredictionsModule } from './predictions/predictions.module';
import { FootballModule } from './football/football.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PrognosticModule } from './prognostic/prognostic.module';
import { PremiumModule } from './premium/premium.module';
import { PaymentsModule } from './payments/payments.module';

/** Aceita true, 1, yes, on (Render e outros painéis variam). */
function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function sslForPostgresUrl(databaseUrl: string | undefined) {
  if (envFlag('DB_SSL')) {
    return { rejectUnauthorized: false as const };
  }
  if (!databaseUrl) return undefined;
  try {
    const host = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'))
      .hostname;
    if (/\.rlwy\.net|railway\.app|render\.com|neon\.tech/i.test(host)) {
      return { rejectUnauthorized: false as const };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function typeOrmOptions(): TypeOrmModuleOptions {
  const synchronize =
    envFlag('DB_SYNC') || process.env.NODE_ENV !== 'production';

  const dbUrl = process.env.DATABASE_URL?.trim();
  const ssl = sslForPostgresUrl(dbUrl);

  if (dbUrl) {
    return {
      type: 'postgres',
      url: dbUrl,
      autoLoadEntities: true,
      synchronize,
      ...(ssl ? { ssl } : {}),
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'prognostico_futebol',
    autoLoadEntities: true,
    synchronize,
    ...(ssl ? { ssl } : {}),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(typeOrmOptions()),
    UsersModule,
    PlansModule,
    PredictionsModule,
    FootballModule,
    AuthModule,
    AdminModule,
    PrognosticModule,
    PremiumModule,
    PaymentsModule,
  ],
  /** Rotas na raiz: AppController (GET /, GET /health). */
  controllers: [AppController],
})
export class AppModule {}

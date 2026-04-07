import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { PredictionsModule } from './predictions/predictions.module';
import { FootballModule } from './football/football.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PrognosticModule } from './prognostic/prognostic.module';
import { PremiumModule } from './premium/premium.module';

function typeOrmOptions(): TypeOrmModuleOptions {
  const synchronize =
    process.env.DB_SYNC === 'true' || process.env.NODE_ENV !== 'production';

  const ssl =
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false as const }
      : undefined;

  if (process.env.DATABASE_URL?.trim()) {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL.trim(),
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
    TypeOrmModule.forRoot(typeOrmOptions()),
    UsersModule,
    PlansModule,
    PredictionsModule,
    FootballModule,
    AuthModule,
    AdminModule,
    PrognosticModule,
    PremiumModule,
  ],
})
export class AppModule {}

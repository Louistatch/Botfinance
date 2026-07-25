import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CooperativesModule } from './modules/cooperatives/cooperatives.module';
import { CreditRequestsModule } from './modules/credit-requests/credit-requests.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CooperativesModule,
    ScoringModule,
    CreditRequestsModule,
    DashboardModule,
    WhatsappModule,
    HealthModule,
  ],
  providers: [
    // Garde JWT appliquée globalement (les routes @Public() sont exemptées).
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

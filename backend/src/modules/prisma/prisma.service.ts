import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service Prisma partagé. Gère le cycle de vie de la connexion.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('Prisma');

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connexion à PostgreSQL établie.');
    } catch (err) {
      this.logger.error('Échec de connexion à PostgreSQL', err as Error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

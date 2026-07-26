import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Crée automatiquement un compte administrateur au premier démarrage
 * (base vide), afin de permettre la connexion au tableau de bord sans étape
 * de seed manuelle. Idempotent : ne fait rien si des utilisateurs existent.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger('AdminBootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.user.count();
      if (count > 0) return;

      const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@creditcep.ai').toLowerCase();
      const password = this.config.get<string>('seed.defaultPassword')!;
      const passwordHash = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          email,
          fullName: 'Administrateur',
          passwordHash,
          role: Role.ADMIN,
        },
      });
      this.logger.log(`Compte administrateur initial créé : ${email}`);
    } catch (err) {
      this.logger.warn(
        'Création de l’administrateur initial ignorée : ' + (err as Error).message,
      );
    }
  }
}

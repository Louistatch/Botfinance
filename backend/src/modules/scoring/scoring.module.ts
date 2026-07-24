import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { PrismaService } from '../prisma/prisma.service';
import { CultureRef } from './scoring.rules';

/**
 * Module du moteur de décision. Au démarrage, il hydrate le catalogue
 * agronomique du service à partir de la table `culture_references` si elle
 * est renseignée (sinon le référentiel par défaut est utilisé).
 */
@Module({
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule implements OnModuleInit {
  private readonly logger = new Logger('ScoringModule');

  constructor(
    private readonly scoring: ScoringService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      const refs = await this.prisma.cultureReference.findMany();
      if (refs.length > 0) {
        const catalog: Record<string, CultureRef> = {};
        for (const r of refs) {
          catalog[r.name.toLowerCase()] = {
            name: r.name.toLowerCase(),
            avgYield: r.avgYield,
            price: r.price,
            volatility: r.volatility,
            cycleMonths: r.cycleMonths,
            waterNeed: r.waterNeed,
          };
        }
        this.scoring.setCultureCatalog(catalog);
        this.logger.log(`Catalogue agronomique chargé (${refs.length} cultures).`);
      }
    } catch {
      this.logger.warn(
        'Table culture_references indisponible — référentiel par défaut utilisé.',
      );
    }
  }
}

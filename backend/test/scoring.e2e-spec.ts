import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ScoringController } from '../src/modules/scoring/scoring.controller';
import { ScoringService } from '../src/modules/scoring/scoring.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Test e2e du moteur exposé via HTTP (POST /scoring/simulate).
 * Le module est bootstrappé isolément (sans base de données ni JWT) pour
 * valider le contrat de l'API et la cohérence du résultat.
 */
describe('Scoring API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ScoringController],
      providers: [ScoringService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /scoring/simulate retourne une décision cohérente', async () => {
    const res = await request(app.getHttpServer())
      .post('/scoring/simulate')
      .send({
        memberCount: 22,
        seniorityYears: 3,
        separationOfPowers: true,
        agHeldRegularly: true,
        keepsRegisters: true,
        keepsMinutes: true,
        trained: true,
        creditType: 'INTERNAL_FUND',
        requestedAmount: 80000,
        cultures: ['tomate', 'piment', 'oignon', 'gombo'],
        totalArea: 2,
        waterAccess: true,
        irrigationType: 'DRIP',
        climateHistory: 'STABLE',
        revenue: 2200000,
        charges: 1050000,
        savings: 60000,
        memberContribution: 8000,
        mandatorySavingsUpToDate: true,
        liquidityReserveRatio: 0.3,
        guaranteeValue: 90000,
        repaymentHistory: 'EXCELLENT',
        par30: 0.02,
      })
      .expect(201);

    const body = res.body;
    expect(body.success).toBe(true);
    const data = body.data;
    expect(data.decision).toBe('ELIGIBLE');
    expect(data.scores.globalScore).toBeGreaterThanOrEqual(70);
    expect(Object.keys(data.scores)).toHaveLength(11);
    expect(data.recommendations.recommendedRate).toBeGreaterThanOrEqual(10);
    expect(data.indicators.var95).toBeGreaterThan(0);
  });

  it('POST /scoring/simulate rejette un corps invalide (400)', async () => {
    await request(app.getHttpServer())
      .post('/scoring/simulate')
      .send({ memberCount: 'abc' })
      .expect(400);
  });
});

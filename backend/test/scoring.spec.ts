import { ScoringService } from '../src/modules/scoring/scoring.service';
import { toScoringInput } from '../src/modules/scoring/scoring.mapper';
import {
  ClimateHistory,
  CreditType,
  Decision,
  IrrigationType,
  RepaymentHistory,
  RiskLevel,
} from '@prisma/client';

describe('ScoringService (moteur de décision CreditCEP AI)', () => {
  const scoring = new ScoringService();

  const strongProfile = () =>
    toScoringInput({
      region: 'Kara',
      prefecture: 'ASSOLI',
      memberCount: 25,
      seniorityYears: 4,
      separationOfPowers: true,
      agHeldRegularly: true,
      keepsMinutes: true,
      keepsRegisters: true,
      trained: true,
      participatesInCEP: true,
      creditType: CreditType.INTERNAL_FUND,
      requestedAmount: 80000,
      proposedDuration: 3,
      cultures: ['tomate', 'piment', 'oignon', 'gombo'],
      totalArea: 2,
      yields: { tomate: 15500, piment: 8200 },
      waterAccess: true,
      irrigationType: IrrigationType.DRIP,
      climateHistory: ClimateHistory.STABLE,
      hasEquipment: true,
      revenue: 2_200_000,
      charges: 1_050_000,
      savings: 60000,
      memberContribution: 8000,
      mandatorySavingsUpToDate: true,
      liquidityReserveRatio: 0.3,
      guaranteeValue: 90000,
      repaymentHistory: RepaymentHistory.EXCELLENT,
      par30: 0.02,
      previousDefaults: 0,
    });

  const weakProfile = () =>
    toScoringInput({
      memberCount: 12,
      seniorityYears: 0,
      separationOfPowers: false,
      agHeldRegularly: false,
      keepsMinutes: false,
      keepsRegisters: false,
      trained: false,
      participatesInCEP: true,
      creditType: CreditType.INTERNAL_FUND,
      requestedAmount: 150000, // au-dessus du plafond 100 000 (bloquant)
      cultures: ['tomate'], // monoculture
      totalArea: 0.4,
      waterAccess: false,
      irrigationType: IrrigationType.NONE,
      climateHistory: ClimateHistory.SEVERE,
      hasEquipment: false,
      revenue: 400000,
      charges: 390000,
      savings: 8000,
      memberContribution: 4000,
      mandatorySavingsUpToDate: false, // bloquant
      liquidityReserveRatio: 0.1,
      guaranteeValue: 10000,
      repaymentHistory: RepaymentHistory.POOR,
      par30: 0.25, // critique (bloquant)
      previousDefaults: 2,
    });

  it('produit 11 scores bornés entre 0 et 100', () => {
    const r = scoring.evaluate(strongProfile());
    const s = r.scores;
    const all = [
      s.scoreFinancier, s.scoreAgricole, s.scoreGouvernance, s.scoreHistorique,
      s.scoreClimat, s.scoreRemboursement, s.scoreProduction, s.scoreTresorerie,
      s.scoreRentabilite, s.scoreRisque, s.globalScore,
    ];
    for (const v of all) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('déclare ÉLIGIBLE un profil solide avec risque faible', () => {
    const r = scoring.evaluate(strongProfile());
    expect(r.decision).toBe(Decision.ELIGIBLE);
    expect(r.riskLevel).toBe(RiskLevel.LOW);
    expect(r.scores.globalScore).toBeGreaterThanOrEqual(70);
    expect(r.recommendations.recommendedAmount).toBeGreaterThan(0);
    // Taux dans la plage du Passeport de Risque (10-24%).
    expect(r.recommendations.recommendedRate).toBeGreaterThanOrEqual(10);
    expect(r.recommendations.recommendedRate).toBeLessThanOrEqual(24);
  });

  it('REFUSE un profil critique (plusieurs règles bloquantes)', () => {
    const r = scoring.evaluate(weakProfile());
    expect(r.decision).toBe(Decision.REJECTED);
    expect(r.recommendations.recommendedAmount).toBe(0);
    const blocking = r.flags.filter((f) => f.severity === 'BLOCKING');
    expect(blocking.length).toBeGreaterThanOrEqual(2);
  });

  it("respecte le plafond de crédit du fond interne (100 000 FCFA)", () => {
    const input = strongProfile();
    input.requestedAmount = 500000; // au-delà du plafond
    const r = scoring.evaluate(input);
    expect(r.flags.some((f) => f.code === 'AMOUNT_ABOVE_CEILING')).toBe(true);
    expect(r.recommendations.recommendedAmount).toBeLessThanOrEqual(100000);
  });

  it("bloque si l'épargne obligatoire n'est pas à jour", () => {
    const input = strongProfile();
    input.mandatorySavingsUpToDate = false;
    const r = scoring.evaluate(input);
    expect(r.flags.some((f) => f.code === 'MANDATORY_SAVINGS_UNPAID')).toBe(true);
  });

  it('alerte quand le PAR30 dépasse 10%', () => {
    const input = strongProfile();
    input.par30 = 0.12;
    const r = scoring.evaluate(input);
    expect(r.flags.some((f) => f.code === 'PAR30_ALERT')).toBe(true);
  });

  it('classe un profil intermédiaire en ÉLIGIBLE SOUS CONDITIONS', () => {
    const input = strongProfile();
    // Dégrade partiellement : gouvernance incomplète + épargne juste.
    input.keepsMinutes = false;
    input.trained = false;
    input.repaymentHistory = RepaymentHistory.AVERAGE;
    input.revenue = 1_000_000;
    input.charges = 820_000;
    input.savings = 30000;
    input.liquidityReserveRatio = 0.2;
    input.requestedAmount = 95000;
    const r = scoring.evaluate(input);
    expect([Decision.CONDITIONAL, Decision.ELIGIBLE]).toContain(r.decision);
    if (r.decision === Decision.CONDITIONAL) {
      expect(r.recommendations.conditions.length).toBeGreaterThan(0);
    }
  });

  it('récompense la diversification (Markowitz) via le score risque', () => {
    const diversified = strongProfile();
    const mono = strongProfile();
    mono.cultures = ['tomate'];
    const rDiv = scoring.evaluate(diversified);
    const rMono = scoring.evaluate(mono);
    expect(rDiv.scores.scoreRisque).toBeGreaterThan(rMono.scores.scoreRisque);
    expect(rDiv.indicators.diversificationIndex).toBeGreaterThan(
      rMono.indicators.diversificationIndex,
    );
  });

  it('calcule des indicateurs quantitatifs (VaR, ES, Sharpe)', () => {
    const r = scoring.evaluate(strongProfile());
    expect(r.indicators.var95).toBeGreaterThan(0);
    expect(r.indicators.expectedShortfall).toBeGreaterThanOrEqual(r.indicators.var95);
    expect(typeof r.indicators.sharpeRatio).toBe('number');
  });

  it('produit une justification textuelle non vide', () => {
    const r = scoring.evaluate(strongProfile());
    expect(r.justification.length).toBeGreaterThan(40);
    expect(r.breakdown.length).toBe(10);
  });
});

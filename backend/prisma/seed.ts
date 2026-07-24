/**
 * Seed de démonstration CreditCEP AI.
 *  - 3 comptes (ADMIN, CREDIT_ANALYST, AGENT)
 *  - Référentiel agronomique (cultures maraîchères)
 *  - Coopératives réelles extraites du fichier « CEP_KARA »
 *  - Quelques demandes de crédit évaluées par le moteur
 */
import { PrismaClient, CreditType, IrrigationType, ClimateHistory, RepaymentHistory } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ScoringService } from '../src/modules/scoring/scoring.service';
import { toScoringInput } from '../src/modules/scoring/scoring.mapper';

const prisma = new PrismaClient();
const scoring = new ScoringService();

const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!';

// Extrait réel du fichier CEP_KARA (région Kara).
const COOPERATIVES = [
  { name: 'BIBONA DE GANDE', cepName: 'BIBONA DE GANDE', prefecture: 'ASSOLI', village: 'Gande', memberCount: 19, presidentName: 'ABIBOU Roukeyatou', presidentPhone: '92496314' },
  { name: 'TIWOU WOVOZI', cepName: 'TIWOU WOVOZI', prefecture: 'ASSOLI', village: 'Gande', memberCount: 17, presidentName: 'ALASSANI Sahadatou', presidentPhone: '91836995' },
  { name: 'WOULANDA DE GANDE', cepName: 'WOULANDA DE GANDE', prefecture: 'ASSOLI', village: 'Gande', memberCount: 15, presidentName: 'TCHANI Zoulouhidjatou', presidentPhone: '70593162' },
  { name: 'NIMOTIM', cepName: 'CEP NIMOTIM', prefecture: 'Dankpen', village: null, memberCount: 25, presidentName: 'Foussena Ibrahime', presidentPhone: '90387616' },
  { name: 'Espoir de kpelouwé', cepName: 'Espoir de kpelouwé', prefecture: 'Kozah', village: null, memberCount: 21, presidentName: 'Kao badabo piniwé', presidentPhone: '93524702' },
  { name: 'Dikpendi', cepName: 'Dikpendi', prefecture: 'Kozah', village: null, memberCount: 25, presidentName: 'Katargnou essohanam', presidentPhone: '92890056' },
  { name: 'Scoops jeune maraîchers', cepName: 'Jeune maraîchers', prefecture: 'Kozah', village: null, memberCount: 29, presidentName: 'Panizi afoua', presidentPhone: '90669312' },
  { name: 'FEZIRE', cepName: 'CEP FEZIRE', prefecture: 'Daoudè', village: 'Soreda', memberCount: 25, presidentName: 'KOYODA sékina', presidentPhone: '91646609' },
  { name: 'ALOU-WEVE', cepName: 'CEP ALOU-WEVE 1', prefecture: 'Daoudè', village: 'Daoude', memberCount: 25, presidentName: 'AGRIGNA FATI', presidentPhone: '91101047' },
  { name: 'ALBARAKA', cepName: 'CEP ALBARAKA', prefecture: 'ASSOLI', village: 'Alédjo Kadara', memberCount: 25, presidentName: 'BOUKARI Aïcha', presidentPhone: '71892366' },
];

const CULTURES = [
  { name: 'tomate', avgYield: 15000, price: 350, volatility: 0.45, cycleMonths: 4, waterNeed: 'HIGH' as const },
  { name: 'piment', avgYield: 8000, price: 600, volatility: 0.3, cycleMonths: 4, waterNeed: 'MEDIUM' as const },
  { name: 'oignon', avgYield: 20000, price: 300, volatility: 0.35, cycleMonths: 5, waterNeed: 'MEDIUM' as const },
  { name: 'gombo', avgYield: 9000, price: 400, volatility: 0.25, cycleMonths: 3, waterNeed: 'MEDIUM' as const },
  { name: 'laitue', avgYield: 18000, price: 250, volatility: 0.28, cycleMonths: 2, waterNeed: 'HIGH' as const },
  { name: 'carotte', avgYield: 22000, price: 350, volatility: 0.22, cycleMonths: 3, waterNeed: 'MEDIUM' as const },
  { name: 'chou', avgYield: 25000, price: 200, volatility: 0.24, cycleMonths: 3, waterNeed: 'HIGH' as const },
  { name: 'aubergine', avgYield: 16000, price: 300, volatility: 0.3, cycleMonths: 4, waterNeed: 'MEDIUM' as const },
];

async function main() {
  console.log('🌱 Seed CreditCEP AI...');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Utilisateurs ──
  await prisma.user.upsert({
    where: { email: 'admin@creditcep.ai' },
    update: {},
    create: { email: 'admin@creditcep.ai', fullName: 'Administrateur', passwordHash, role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'analyste@creditcep.ai' },
    update: {},
    create: { email: 'analyste@creditcep.ai', fullName: 'Analyste Crédit', passwordHash, role: 'CREDIT_ANALYST' },
  });
  await prisma.user.upsert({
    where: { email: 'agent@creditcep.ai' },
    update: {},
    create: { email: 'agent@creditcep.ai', fullName: 'Agent de Terrain', passwordHash, role: 'AGENT' },
  });
  console.log('  ✓ 3 utilisateurs');

  // ── Cultures de référence ──
  for (const c of CULTURES) {
    await prisma.cultureReference.upsert({
      where: { name: c.name },
      update: c,
      create: c,
    });
  }
  console.log(`  ✓ ${CULTURES.length} cultures de référence`);

  // ── Coopératives ──
  const year = new Date().getFullYear();
  let i = 0;
  for (const c of COOPERATIVES) {
    i++;
    const code = `COOP-${year}-${String(i).padStart(4, '0')}`;
    // Profils de gouvernance variés pour illustrer les trois décisions.
    const strong = i % 3 === 0;
    const weak = i % 5 === 0;
    const coop = await prisma.cooperative.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: c.name,
        cepName: c.cepName,
        region: 'Kara',
        prefecture: c.prefecture,
        village: c.village,
        memberCount: c.memberCount,
        presidentName: c.presidentName,
        presidentPhone: c.presidentPhone,
        contactPhone: c.presidentPhone,
        seniorityYears: strong ? 4 : weak ? 0 : 2,
        separationOfPowers: !weak,
        agHeldRegularly: !weak,
        keepsMinutes: strong,
        keepsRegisters: !weak,
        trained: strong || i % 2 === 0,
        participatesInCEP: true,
      },
    });

    // Une demande de crédit par coopérative
    const reference = `DEM-${year}-${String(i).padStart(6, '0')}`;
    const cultures = strong
      ? ['tomate', 'piment', 'oignon', 'gombo']
      : weak
        ? ['tomate']
        : ['tomate', 'oignon'];
    const request = await prisma.creditRequest.upsert({
      where: { reference },
      update: {},
      create: {
        reference,
        cooperativeId: coop.id,
        creditType: CreditType.INTERNAL_FUND,
        requestedAmount: weak ? 150000 : strong ? 80000 : 95000,
        purpose: 'Achat de semences, intrants et petit matériel de production',
        proposedDuration: 3,
        cultures,
        totalArea: strong ? 2 : weak ? 0.4 : 1.2,
        yields: strong ? { tomate: 15500, piment: 8200 } : { tomate: 12000 },
        waterAccess: !weak,
        irrigationType: strong ? IrrigationType.DRIP : weak ? IrrigationType.NONE : IrrigationType.MOTOR_PUMP,
        climateHistory: strong ? ClimateHistory.STABLE : weak ? ClimateHistory.SEVERE : ClimateHistory.MODERATE,
        hasEquipment: !weak,
        revenue: strong ? 2200000 : weak ? 400000 : 1400000,
        charges: strong ? 1100000 : weak ? 380000 : 900000,
        savings: strong ? 60000 : weak ? 8000 : 40000,
        memberContribution: strong ? 8000 : 4000,
        mandatorySavingsUpToDate: !weak,
        liquidityReserveRatio: strong ? 0.3 : weak ? 0.1 : 0.22,
        guaranteeValue: strong ? 90000 : weak ? 10000 : 50000,
        repaymentHistory: strong ? RepaymentHistory.EXCELLENT : weak ? RepaymentHistory.POOR : RepaymentHistory.GOOD,
        par30: strong ? 0.02 : weak ? 0.25 : 0.06,
        previousDefaults: weak ? 2 : 0,
        source: 'DASHBOARD',
        status: 'SUBMITTED',
      },
    });

    // Évaluation par le moteur
    const input = toScoringInput({
      region: coop.region, prefecture: coop.prefecture,
      memberCount: coop.memberCount, seniorityYears: coop.seniorityYears,
      separationOfPowers: coop.separationOfPowers, agHeldRegularly: coop.agHeldRegularly,
      keepsMinutes: coop.keepsMinutes, keepsRegisters: coop.keepsRegisters,
      trained: coop.trained, participatesInCEP: coop.participatesInCEP,
      creditType: request.creditType, requestedAmount: request.requestedAmount,
      proposedDuration: request.proposedDuration, cultures: request.cultures,
      totalArea: request.totalArea, yields: request.yields as Record<string, number>,
      waterAccess: request.waterAccess, irrigationType: request.irrigationType,
      climateHistory: request.climateHistory, hasEquipment: request.hasEquipment,
      revenue: request.revenue, charges: request.charges, savings: request.savings,
      memberContribution: request.memberContribution,
      mandatorySavingsUpToDate: request.mandatorySavingsUpToDate,
      liquidityReserveRatio: request.liquidityReserveRatio,
      guaranteeValue: request.guaranteeValue, repaymentHistory: request.repaymentHistory,
      par30: request.par30, previousDefaults: request.previousDefaults,
    });
    const result = scoring.evaluate(input);
    const status = result.decision === 'ELIGIBLE' ? 'APPROVED' : result.decision === 'CONDITIONAL' ? 'CONDITIONAL' : 'REJECTED';

    await prisma.evaluation.upsert({
      where: { creditRequestId: request.id },
      update: {},
      create: {
        creditRequestId: request.id,
        scoreFinancier: result.scores.scoreFinancier,
        scoreAgricole: result.scores.scoreAgricole,
        scoreGouvernance: result.scores.scoreGouvernance,
        scoreHistorique: result.scores.scoreHistorique,
        scoreClimat: result.scores.scoreClimat,
        scoreRemboursement: result.scores.scoreRemboursement,
        scoreProduction: result.scores.scoreProduction,
        scoreTresorerie: result.scores.scoreTresorerie,
        scoreRentabilite: result.scores.scoreRentabilite,
        scoreRisque: result.scores.scoreRisque,
        globalScore: result.scores.globalScore,
        riskLevel: result.riskLevel,
        decision: result.decision,
        justification: result.justification,
        breakdown: result.breakdown as any,
        flags: result.flags as any,
        recommendedAmount: result.recommendations.recommendedAmount,
        recommendedDuration: result.recommendations.recommendedDuration,
        recommendedDeferral: result.recommendations.recommendedDeferral,
        recommendedRate: result.recommendations.recommendedRate,
        additionalGuarantees: result.recommendations.additionalGuarantees as any,
        favoredCultures: result.recommendations.favoredCultures as any,
        riskyCultures: result.recommendations.riskyCultures as any,
        technicalRecommendations: result.recommendations.technicalRecommendations as any,
        financialRecommendations: result.recommendations.financialRecommendations as any,
        conditions: result.recommendations.conditions as any,
        var95: result.indicators.var95,
        expectedShortfall: result.indicators.expectedShortfall,
        sharpeRatio: result.indicators.sharpeRatio,
        diversificationIndex: result.indicators.diversificationIndex,
        engineVersion: result.engineVersion,
      },
    });
    await prisma.creditRequest.update({ where: { id: request.id }, data: { status } });
  }
  console.log(`  ✓ ${COOPERATIVES.length} coopératives + demandes évaluées`);
  console.log('✅ Seed terminé. Compte admin: admin@creditcep.ai / ' + PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

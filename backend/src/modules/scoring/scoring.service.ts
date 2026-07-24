import { Injectable } from '@nestjs/common';
import { Decision, RiskLevel } from '@prisma/client';
import {
  Recommendations,
  QuantIndicators,
  ScoreBreakdownItem,
  ScoringFlag,
  ScoringInput,
  ScoringResult,
} from './scoring.types';
import {
  CLIMATE_SCORE,
  CREDIT_RULES,
  CultureRef,
  DECISION_THRESHOLDS,
  DEFAULT_CULTURES,
  DIVERSIFICATION,
  ENGINE_VERSION,
  GOVERNANCE_POINTS,
  IRRIGATION_SCORE,
  LIQUIDITY_RULES,
  MEMBERSHIP,
  PAR30,
  RATE_PASSPORT,
  REPAYMENT_SCORE,
  RISK_FREE_RATE,
  RISK_THRESHOLDS,
  SCORE_WEIGHTS,
} from './scoring.rules';

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const round = (v: number, d = 2) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MOTEUR DE DÉCISION CreditCEP AI
 * ═══════════════════════════════════════════════════════════════════════════
 *  Calcule 11 scores métier, applique les règles bloquantes officielles,
 *  détermine le niveau de risque (Passeport de Risque) et la décision, puis
 *  produit des recommandations financières et agronomiques.
 *
 *  Toutes les constantes proviennent de `scoring.rules.ts` (traçabilité
 *  documentaire : PDF ProSMAT, TDR, Excel CEP).
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class ScoringService {
  /** Référentiel agronomique injectable (surcharge la table par défaut). */
  private cultureCatalog: Record<string, CultureRef> = DEFAULT_CULTURES;

  setCultureCatalog(catalog: Record<string, CultureRef>) {
    this.cultureCatalog = { ...DEFAULT_CULTURES, ...catalog };
  }

  /** Point d'entrée principal : évalue un dossier complet. */
  evaluate(input: ScoringInput): ScoringResult {
    const flags: ScoringFlag[] = [];

    // 1) Calcul des 11 scores
    const scoreFinancier = this.scoreFinancier(input);
    const scoreAgricole = this.scoreAgricole(input);
    const scoreGouvernance = this.scoreGouvernance(input);
    const scoreHistorique = this.scoreHistorique(input, flags);
    const scoreClimat = this.scoreClimat(input);
    const scoreRemboursement = this.scoreRemboursement(input, flags);
    const scoreProduction = this.scoreProduction(input);
    const scoreTresorerie = this.scoreTresorerie(input, flags);
    const scoreRentabilite = this.scoreRentabilite(input);
    const scoreRisque = this.scoreRisque(input, flags);

    const breakdown: ScoreBreakdownItem[] = [
      this.item('financier', 'Score financier', scoreFinancier, SCORE_WEIGHTS.financier,
        'Solidité des flux : chiffre d’affaires, charges et marge.'),
      this.item('agricole', 'Score agricole', scoreAgricole, SCORE_WEIGHTS.agricole,
        'Assise productive : superficie, accès à l’eau, irrigation, équipements.'),
      this.item('gouvernance', 'Score gouvernance', scoreGouvernance, SCORE_WEIGHTS.gouvernance,
        'Séparation des pouvoirs, AG, procès-verbaux, registres, formation.'),
      this.item('historique', 'Score historique', scoreHistorique, SCORE_WEIGHTS.historique,
        'Antécédents de remboursement et incidents passés.'),
      this.item('climat', 'Score climat', scoreClimat, SCORE_WEIGHTS.climat,
        'Résilience climatique et maîtrise de l’irrigation.'),
      this.item('remboursement', 'Score remboursement', scoreRemboursement, SCORE_WEIGHTS.remboursement,
        'Capacité de remboursement au regard du montant demandé.'),
      this.item('production', 'Score production', scoreProduction, SCORE_WEIGHTS.production,
        'Rendements observés comparés aux références régionales.'),
      this.item('tresorerie', 'Score trésorerie', scoreTresorerie, SCORE_WEIGHTS.tresorerie,
        'Épargne mobilisée, réserve de liquidité et PAR30.'),
      this.item('rentabilite', 'Score rentabilité', scoreRentabilite, SCORE_WEIGHTS.rentabilite,
        'Marge nette et rendement du portefeuille cultural.'),
      this.item('risque', 'Score risque', scoreRisque, SCORE_WEIGHTS.risque,
        'Diversification (Markowitz) et volatilité du revenu (VaR).'),
    ];

    // 2) Score global pondéré
    const globalScore = round(
      breakdown.reduce((sum, it) => sum + it.weightedScore, 0),
    );

    // 3) Niveau de risque (Passeport de Risque)
    const riskLevel = this.riskLevel(globalScore, flags);

    // 4) Indicateurs quantitatifs (VaR, ES, Sharpe, diversification)
    const indicators = this.quantIndicators(input);

    // 5) Décision (score + règles bloquantes)
    const decision = this.decide(globalScore, flags);

    // 6) Recommandations
    const recommendations = this.recommend(input, decision, riskLevel, globalScore, flags);

    // 7) Justification textuelle
    const justification = this.buildJustification(
      decision, riskLevel, globalScore, breakdown, flags,
    );

    return {
      scores: {
        scoreFinancier, scoreAgricole, scoreGouvernance, scoreHistorique,
        scoreClimat, scoreRemboursement, scoreProduction, scoreTresorerie,
        scoreRentabilite, scoreRisque, globalScore,
      },
      riskLevel,
      decision,
      justification,
      breakdown,
      flags,
      recommendations,
      indicators,
      engineVersion: ENGINE_VERSION,
    };
  }

  // ───────────────────────── SCORES INDIVIDUELS ─────────────────────────

  /** Score financier : marge nette relative au chiffre d'affaires. */
  private scoreFinancier(i: ScoringInput): number {
    const revenue = i.revenue ?? 0;
    const charges = i.charges ?? 0;
    if (revenue <= 0) return 20;
    const margin = (revenue - charges) / revenue; // marge nette
    // marge ≥ 40% -> excellent ; ≤ 0% -> critique
    let score = clamp(30 + margin * 150);
    // Bonus de volume d'activité (activité réelle)
    if (revenue >= 2_000_000) score += 8;
    else if (revenue >= 500_000) score += 4;
    return clamp(round(score));
  }

  /** Score agricole : assise productive. */
  private scoreAgricole(i: ScoringInput): number {
    let score = 30;
    const area = i.totalArea ?? 0;
    if (area >= 2) score += 25;
    else if (area >= 1) score += 18;
    else if (area >= 0.5) score += 12;
    else if (area > 0) score += 6;

    score += (IRRIGATION_SCORE[i.irrigationType] ?? 20) * 0.25;
    if (i.waterAccess) score += 10;
    if (i.hasEquipment) score += 8;
    if ((i.laborForce ?? 0) >= i.memberCount * 0.5) score += 4;
    return clamp(round(score));
  }

  /** Score gouvernance : barème anti-fraude [PDF]. */
  private scoreGouvernance(i: ScoringInput): number {
    let score = 0;
    if (i.separationOfPowers) score += GOVERNANCE_POINTS.separationOfPowers;
    if (i.agHeldRegularly) score += GOVERNANCE_POINTS.agHeldRegularly;
    if (i.keepsMinutes) score += GOVERNANCE_POINTS.keepsMinutes;
    if (i.keepsRegisters) score += GOVERNANCE_POINTS.keepsRegisters;
    if (i.trained) score += GOVERNANCE_POINTS.trained;
    if (i.participatesInCEP) score += GOVERNANCE_POINTS.participatesInCEP;

    // Modulation par la taille & l'ancienneté (solidité collective)
    if (i.memberCount >= MEMBERSHIP.strong) score += 3;
    else if (i.memberCount < MEMBERSHIP.min) score -= 8;
    if (i.seniorityYears >= 3) score += 4;
    else if (i.seniorityYears < 1) score -= 4;
    return clamp(round(score));
  }

  /** Score historique de remboursement. */
  private scoreHistorique(i: ScoringInput, flags: ScoringFlag[]): number {
    let score = REPAYMENT_SCORE[i.repaymentHistory] ?? 50;
    if (i.previousDefaults > 0) {
      score -= Math.min(40, i.previousDefaults * 15);
      flags.push({
        code: 'PREVIOUS_DEFAULTS',
        severity: i.previousDefaults >= 2 ? 'BLOCKING' : 'WARNING',
        message: `${i.previousDefaults} incident(s) de remboursement antérieur(s).`,
      });
    }
    return clamp(round(score));
  }

  /** Score climat : stabilité climatique + irrigation. */
  private scoreClimat(i: ScoringInput): number {
    const base = CLIMATE_SCORE[i.climateHistory] ?? 60;
    const irrigation = IRRIGATION_SCORE[i.irrigationType] ?? 20;
    // L'irrigation atténue le risque climatique.
    return clamp(round(base * 0.65 + irrigation * 0.35));
  }

  /**
   * Score remboursement : capacité à rembourser le montant demandé.
   * S'appuie sur la marge disponible et la règle d'or crédit/épargne [PDF].
   */
  private scoreRemboursement(i: ScoringInput, flags: ScoringFlag[]): number {
    const rules = CREDIT_RULES[i.creditType];
    const revenue = i.revenue ?? 0;
    const charges = i.charges ?? 0;
    const netMargin = Math.max(0, revenue - charges);
    const requested = i.requestedAmount;

    // Ratio de couverture : marge nette annuelle / montant demandé.
    let score = 40;
    if (requested > 0) {
      const coverage = netMargin / requested;
      score = clamp(20 + coverage * 60);
    }

    // Règle d'or : crédit ≤ 2-3× épargne.
    const savings = i.savings;
    if (savings > 0) {
      const ratio = requested / savings;
      if (ratio <= rules.prudentSavingsMultiple) score += 15;
      else if (ratio <= rules.maxSavingsMultiple) score += 5;
      else {
        score -= 20;
        flags.push({
          code: 'CREDIT_OVER_SAVINGS',
          severity: 'WARNING',
          message: `Montant demandé (${requested} FCFA) supérieur à ${rules.maxSavingsMultiple}× l'épargne (${savings} FCFA) — règle d'or dépassée.`,
        });
      }
    } else {
      score -= 15;
    }

    // Plafond réglementaire dépassé -> bloquant.
    if (requested > rules.maxAmount) {
      score -= 25;
      flags.push({
        code: 'AMOUNT_ABOVE_CEILING',
        severity: 'BLOCKING',
        message: `Montant demandé (${requested} FCFA) au-dessus du plafond ${rules.maxAmount} FCFA (${i.creditType}).`,
      });
    }
    return clamp(round(score));
  }

  /** Score production : rendements observés vs références régionales. */
  private scoreProduction(i: ScoringInput): number {
    const yields = i.yields ?? {};
    const cultures = i.cultures ?? [];
    if (cultures.length === 0) return 40;

    const ratios: number[] = [];
    for (const c of cultures) {
      const ref = this.cultureCatalog[c.toLowerCase()];
      const observed = yields[c] ?? yields[c.toLowerCase()];
      if (ref && observed && observed > 0) {
        ratios.push(Math.min(1.3, observed / ref.avgYield));
      }
    }
    if (ratios.length === 0) return 55; // pas de données de rendement : neutre.
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return clamp(round(avg * 80 + 10));
  }

  /**
   * Score trésorerie : épargne mobilisée, réserve de liquidité & PAR30 [PDF].
   */
  private scoreTresorerie(i: ScoringInput, flags: ScoringFlag[]): number {
    let score = 30;

    // Épargne obligatoire à jour = condition d'accès au crédit [PDF Module 4].
    if (i.mandatorySavingsUpToDate) score += 25;
    else {
      flags.push({
        code: 'MANDATORY_SAVINGS_UNPAID',
        severity: 'BLOCKING',
        message: "Épargne obligatoire non à jour — condition d'accès au crédit non remplie [PDF].",
      });
    }

    // Niveau d'épargne mobilisée par rapport au montant demandé.
    if (i.requestedAmount > 0) {
      const cover = i.savings / i.requestedAmount;
      score += clamp(cover * 30, 0, 25);
    }

    // Réserve de liquidité ≥ 20-25% [PDF p.10].
    const reserve = i.liquidityReserveRatio;
    if (reserve != null) {
      if (reserve >= LIQUIDITY_RULES.targetReserveRatio) score += 20;
      else if (reserve >= LIQUIDITY_RULES.minReserveRatio) score += 10;
      else {
        score -= 10;
        flags.push({
          code: 'LOW_LIQUIDITY',
          severity: 'WARNING',
          message: `Réserve de liquidité (${round(reserve * 100)}%) sous le minimum de 20% [PDF p.10].`,
        });
      }
    }

    // PAR30 [PDF p.10].
    const par = i.par30;
    if (par != null) {
      if (par >= PAR30.criticalThreshold) {
        score -= 25;
        flags.push({
          code: 'PAR30_CRITICAL',
          severity: 'BLOCKING',
          message: `PAR30 = ${round(par * 100)}% (≥ 20%) — portefeuille critique.`,
        });
      } else if (par >= PAR30.alertThreshold) {
        score -= 12;
        flags.push({
          code: 'PAR30_ALERT',
          severity: 'WARNING',
          message: `PAR30 = ${round(par * 100)}% (≥ 10%) — plan de recouvrement requis [PDF p.10].`,
        });
      } else {
        score += 8;
      }
    }
    return clamp(round(score));
  }

  /** Score rentabilité : marge nette (proxy de performance). */
  private scoreRentabilite(i: ScoringInput): number {
    const revenue = i.revenue ?? 0;
    const charges = i.charges ?? 0;
    if (revenue <= 0) return 25;
    const margin = (revenue - charges) / revenue;
    // Croisé avec le rendement théorique du portefeuille cultural.
    const portfolioReturn = this.expectedPortfolioReturn(i);
    const returnScore = clamp(portfolioReturn * 0.0002); // FCFA/ha -> échelle 0-100
    return clamp(round(clamp(20 + margin * 140) * 0.6 + returnScore * 0.4));
  }

  /** Score risque : diversification (Markowitz) & volatilité du revenu (VaR). */
  private scoreRisque(i: ScoringInput, flags: ScoringFlag[]): number {
    const cultures = (i.cultures ?? []).map((c) => c.toLowerCase());
    if (cultures.length === 0) {
      flags.push({
        code: 'NO_CULTURE',
        severity: 'WARNING',
        message: 'Aucune culture renseignée — diversification non évaluable.',
      });
      return 35;
    }

    // Diversification : score maximal autour de l'optimum de cultures.
    const n = cultures.length;
    let diversScore: number;
    if (n >= DIVERSIFICATION.idealCultureCount) diversScore = 100;
    else if (n === 3) diversScore = 85;
    else if (n === DIVERSIFICATION.minCultureCount) diversScore = 65;
    else diversScore = 40; // monoculture : risque de faillite en cas de choc prix [TDR].

    if (n < DIVERSIFICATION.minCultureCount) {
      flags.push({
        code: 'LOW_DIVERSIFICATION',
        severity: 'WARNING',
        message: 'Monoculture : forte exposition au risque de chute de prix [TDR].',
      });
    }

    // Volatilité moyenne pondérée du portefeuille (proxy VaR).
    const vol = this.portfolioVolatility(cultures);
    const volScore = clamp(100 - vol * 160);

    return clamp(round(diversScore * 0.55 + volScore * 0.45));
  }

  // ───────────────────────── INDICATEURS QUANTITATIFS (TDR) ─────────────────────────

  /** Rendement attendu du portefeuille cultural (FCFA/ha, pondéré). */
  private expectedPortfolioReturn(i: ScoringInput): number {
    const cultures = (i.cultures ?? []).map((c) => c.toLowerCase());
    if (cultures.length === 0) return 0;
    const perCulture = cultures.map((c) => {
      const ref = this.cultureCatalog[c];
      return ref ? ref.avgYield * ref.price : 0;
    });
    const total = perCulture.reduce((a, b) => a + b, 0);
    return total / cultures.length;
  }

  /** Volatilité du portefeuille : moyenne des volatilités atténuée par la diversification. */
  private portfolioVolatility(cultures: string[]): number {
    if (cultures.length === 0) return 0.5;
    const vols = cultures.map((c) => this.cultureCatalog[c]?.volatility ?? 0.4);
    const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
    // Bénéfice de diversification (corrélation imparfaite) ~ 1/sqrt(n).
    const diversFactor = 1 / Math.sqrt(cultures.length);
    return round(avg * (0.5 + 0.5 * diversFactor), 4);
  }

  /**
   * Indicateurs de risque financier [TDR] :
   *  - VaR 95% : perte maximale probable sur le revenu attendu.
   *  - Expected Shortfall (CVaR) : perte moyenne au-delà de la VaR.
   *  - Ratio de Sharpe : (rendement - taux sans risque) / volatilité.
   *  - Indice de diversification : 0-1.
   */
  private quantIndicators(i: ScoringInput): QuantIndicators {
    const cultures = (i.cultures ?? []).map((c) => c.toLowerCase());
    const area = i.totalArea ?? 1;
    const expectedReturnPerHa = this.expectedPortfolioReturn(i);
    const expectedRevenue = expectedReturnPerHa * area;
    const vol = this.portfolioVolatility(cultures.length ? cultures : ['tomate']);

    // VaR 95% paramétrique : z(0.95) ≈ 1.645.
    const z95 = 1.645;
    const var95 = round(expectedRevenue * vol * z95);
    // Expected Shortfall ≈ VaR × (φ(z)/(1-α)) / z ; facteur ≈ 1.256 pour α=95%.
    const expectedShortfall = round(var95 * 1.256);

    const sharpe =
      vol > 0
        ? round(
            (expectedReturnPerHa / Math.max(1, expectedReturnPerHa) - RISK_FREE_RATE) /
              vol,
            3,
          )
        : 0;
    // Sharpe stylisé : rendement relatif ajusté du risque.
    const sharpeRatio = round(((1 - RISK_FREE_RATE) / Math.max(0.05, vol)) * 0.1, 3);

    const n = cultures.length;
    const diversificationIndex = round(
      clamp(n / DIVERSIFICATION.idealCultureCount, 0, 1),
      3,
    );

    return { var95, expectedShortfall, sharpeRatio, diversificationIndex };
  }

  // ───────────────────────── RISQUE & DÉCISION ─────────────────────────

  private riskLevel(globalScore: number, flags: ScoringFlag[]): RiskLevel {
    const blocking = flags.some((f) => f.severity === 'BLOCKING');
    if (blocking) {
      // Une règle bloquante dégrade d'au moins un cran le risque.
      if (globalScore >= RISK_THRESHOLDS.low) return RiskLevel.MEDIUM;
      if (globalScore >= RISK_THRESHOLDS.medium) return RiskLevel.HIGH;
      return RiskLevel.VERY_HIGH;
    }
    if (globalScore >= RISK_THRESHOLDS.low) return RiskLevel.LOW;
    if (globalScore >= RISK_THRESHOLDS.medium) return RiskLevel.MEDIUM;
    if (globalScore >= RISK_THRESHOLDS.high) return RiskLevel.HIGH;
    return RiskLevel.VERY_HIGH;
  }

  private decide(globalScore: number, flags: ScoringFlag[]): Decision {
    const blocking = flags.filter((f) => f.severity === 'BLOCKING');
    // Deux règles bloquantes ou plus -> refus systématique.
    if (blocking.length >= 2) return Decision.REJECTED;

    if (globalScore >= DECISION_THRESHOLDS.eligible) {
      // Une seule règle bloquante rétrograde en « sous conditions ».
      return blocking.length === 1 ? Decision.CONDITIONAL : Decision.ELIGIBLE;
    }
    if (globalScore >= DECISION_THRESHOLDS.conditional) {
      return blocking.length >= 1 ? Decision.REJECTED : Decision.CONDITIONAL;
    }
    return Decision.REJECTED;
  }

  // ───────────────────────── RECOMMANDATIONS ─────────────────────────

  private recommend(
    i: ScoringInput,
    decision: Decision,
    risk: RiskLevel,
    globalScore: number,
    flags: ScoringFlag[],
  ): Recommendations {
    const rules = CREDIT_RULES[i.creditType];

    // Montant recommandé : min(plafond, règle d'or épargne, capacité de marge).
    const byCeiling = rules.maxAmount;
    const bySavings = i.savings > 0
      ? i.savings * rules.prudentSavingsMultiple
      : rules.maxAmount;
    const byContribution = i.memberContribution > 0
      ? i.memberContribution * rules.maxContributionMultiple
      : rules.maxAmount;
    const netMargin = Math.max(0, (i.revenue ?? 0) - (i.charges ?? 0));
    const byCapacity = netMargin > 0 ? netMargin * 0.8 : rules.maxAmount;

    let recommendedAmount = Math.min(
      i.requestedAmount || rules.maxAmount,
      byCeiling, bySavings, byContribution, byCapacity,
    );
    // Modulation par le score global (frilosité si score faible).
    const scoreFactor = clamp(globalScore, 30, 100) / 100;
    recommendedAmount = Math.round((recommendedAmount * scoreFactor) / 1000) * 1000;
    if (decision === Decision.REJECTED) recommendedAmount = 0;

    // Durée & différé conseillés (bornés par les règles).
    const recommendedDuration = Math.min(
      i.proposedDuration ?? rules.maxDurationMonths,
      rules.maxDurationMonths,
    );
    const recommendedDeferral = Math.min(
      i.proposedDeferral ?? 0,
      rules.maxDeferralMonths,
    );

    // Taux conseillé : Passeport de Risque (interpolation base -> max).
    const recommendedRate = this.recommendRate(i.creditType, risk);

    // Cultures à privilégier / à risque (volatilité de référence).
    const { favored, risky } = this.classifyCultures(i.cultures);

    // Garanties complémentaires.
    const additionalGuarantees = this.recommendGuarantees(i, recommendedAmount);

    // Recommandations techniques & financières.
    const technicalRecommendations = this.technicalRecos(i);
    const financialRecommendations = this.financialRecos(i, flags);
    const conditions =
      decision === Decision.CONDITIONAL ? this.buildConditions(i, flags) : [];

    return {
      recommendedAmount,
      recommendedDuration,
      recommendedDeferral,
      recommendedRate,
      additionalGuarantees,
      favoredCultures: favored,
      riskyCultures: risky,
      technicalRecommendations,
      financialRecommendations,
      conditions,
    };
  }

  private recommendRate(creditType: ScoringInput['creditType'], risk: RiskLevel): number {
    const base = CREDIT_RULES[creditType].baseRate;
    const { min, max } = RATE_PASSPORT;
    // Prime de risque additionnée au taux de base, plafonnée au taux « hors passeport ».
    const premium: Record<RiskLevel, number> = {
      LOW: 0,
      MEDIUM: (max - min) * 0.33,
      HIGH: (max - min) * 0.66,
      VERY_HIGH: max - min,
    };
    return round(Math.min(max, Math.max(min, base) + premium[risk]), 2);
  }

  private classifyCultures(cultures: string[]): { favored: string[]; risky: string[] } {
    const favored: string[] = [];
    const risky: string[] = [];
    for (const [name, ref] of Object.entries(this.cultureCatalog)) {
      if (ref.volatility <= DIVERSIFICATION.lowVolatilityThreshold) favored.push(name);
      else if (ref.volatility >= DIVERSIFICATION.highVolatilityThreshold) risky.push(name);
    }
    // Priorise celles déjà cultivées quand elles sont sûres.
    const current = new Set((cultures ?? []).map((c) => c.toLowerCase()));
    favored.sort((a, b) => (current.has(b) ? 1 : 0) - (current.has(a) ? 1 : 0));
    return { favored: favored.slice(0, 5), risky: risky.slice(0, 5) };
  }

  private recommendGuarantees(i: ScoringInput, amount: number): string[] {
    const g: string[] = [];
    const guaranteeValue = i.guaranteeValue ?? 0;
    if (guaranteeValue < amount * 0.5) {
      g.push('Constituer une garantie couvrant au moins 50% du montant octroyé.');
    }
    g.push("Caution solidaire du bureau (Présidente, Trésorière) [PDF Module 3].");
    if (i.creditType === 'EXTERNAL_WAGES') {
      g.push('Caution de 10% et assurance décès 0,66% exigées par WAGES [PDF Module 5].');
    }
    if (!i.hasEquipment) {
      g.push('Nantissement du petit matériel de production financé (kits d’irrigation, brouettes).');
    }
    return g;
  }

  private technicalRecos(i: ScoringInput): string[] {
    const r: string[] = [];
    if (i.irrigationType === 'NONE' || i.irrigationType === 'MANUAL') {
      r.push("Installer un kit d'irrigation (goutte-à-goutte ou californien) pour sécuriser la production.");
    }
    if (!i.waterAccess) {
      r.push("Sécuriser l'accès à l'eau (forage, retenue) avant décaissement.");
    }
    if ((i.cultures?.length ?? 0) < DIVERSIFICATION.minCultureCount) {
      r.push('Diversifier vers au moins 3 cultures maraîchères pour lisser le risque de prix [TDR].');
    }
    if (i.climateHistory === 'UNSTABLE' || i.climateHistory === 'SEVERE') {
      r.push("Adopter des variétés à cycle court et des pratiques agro-écologiques de rétention d'eau.");
    }
    if (!i.trained) {
      r.push('Suivre la formation ProSMAT de gestion des CEP et bonnes pratiques.');
    }
    if (r.length === 0) {
      r.push('Maintenir les bonnes pratiques agro-écologiques et le calendrier cultural.');
    }
    return r;
  }

  private financialRecos(i: ScoringInput, flags: ScoringFlag[]): string[] {
    const r: string[] = [];
    if (!i.mandatorySavingsUpToDate) {
      r.push("Régulariser l'épargne obligatoire : condition d'accès au crédit [PDF Module 4].");
    }
    if ((i.liquidityReserveRatio ?? 1) < LIQUIDITY_RULES.minReserveRatio) {
      r.push('Constituer une réserve de liquidité d’au moins 20-25% des ressources [PDF p.10].');
    }
    if ((i.par30 ?? 0) >= PAR30.alertThreshold) {
      r.push('Mettre en place un plan de recouvrement (PAR30 > 10%) avant tout nouveau décaissement [PDF p.10].');
    }
    if (flags.some((f) => f.code === 'CREDIT_OVER_SAVINGS')) {
      r.push("Réduire le montant demandé pour respecter la règle d'or (crédit ≤ 2-3× épargne).");
    }
    r.push('Tenir quotidiennement les registres (membres, cotisations, crédits) [PDF Module 6].');
    return r;
  }

  private buildConditions(i: ScoringInput, flags: ScoringFlag[]): string[] {
    const c = flags
      .filter((f) => f.severity === 'BLOCKING' || f.severity === 'WARNING')
      .map((f) => `Lever le point : ${f.message}`);
    if (!i.keepsRegisters) c.push('Mettre à jour et présenter les registres obligatoires.');
    if (!i.agHeldRegularly) c.push('Tenir une Assemblée Générale et présenter les comptes.');
    if (c.length === 0) {
      c.push('Signature d’une convention de crédit et suivi mensuel du remboursement.');
    }
    return c;
  }

  // ───────────────────────── JUSTIFICATION ─────────────────────────

  private buildJustification(
    decision: Decision,
    risk: RiskLevel,
    globalScore: number,
    breakdown: ScoreBreakdownItem[],
    flags: ScoringFlag[],
  ): string {
    const label: Record<Decision, string> = {
      ELIGIBLE: 'Coopérative Éligible',
      CONDITIONAL: 'Coopérative Éligible sous conditions',
      REJECTED: 'Coopérative Non Éligible',
    };
    const riskLabel: Record<RiskLevel, string> = {
      LOW: 'faible',
      MEDIUM: 'moyen',
      HIGH: 'élevé',
      VERY_HIGH: 'très élevé',
    };

    const strengths = [...breakdown]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((b) => `${b.label} (${b.score}/100)`);
    const weaknesses = [...breakdown]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((b) => `${b.label} (${b.score}/100)`);

    const blocking = flags.filter((f) => f.severity === 'BLOCKING');

    let text = `Décision : ${label[decision]}. `;
    text += `Score global de ${globalScore}/100, niveau de risque ${riskLabel[risk]}. `;
    text += `Points forts : ${strengths.join(', ')}. `;
    text += `Points de vigilance : ${weaknesses.join(', ')}. `;
    if (blocking.length > 0) {
      text += `Règles bloquantes : ${blocking.map((f) => f.message).join(' ; ')} `;
    }
    if (decision === Decision.ELIGIBLE) {
      text += "La coopérative satisfait les critères d'octroi (grille CEP / ProSMAT).";
    } else if (decision === Decision.CONDITIONAL) {
      text += 'Octroi possible sous réserve de la levée des conditions listées.';
    } else {
      text += "Les conditions d'octroi ne sont pas réunies à ce stade.";
    }
    return text;
  }

  // ───────────────────────── UTIL ─────────────────────────

  private item(
    key: string,
    label: string,
    score: number,
    weight: number,
    comment: string,
  ): ScoreBreakdownItem {
    return {
      key,
      label,
      score: round(score),
      weight,
      weightedScore: round(score * weight),
      comment,
    };
  }
}

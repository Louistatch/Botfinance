import {
  ClimateHistory,
  CreditType,
  Decision,
  IrrigationType,
  RepaymentHistory,
  RiskLevel,
} from '@prisma/client';

/**
 * Données d'entrée normalisées du moteur de scoring.
 * Regroupe l'identité/gouvernance de la coopérative et le dossier de crédit.
 */
export interface ScoringInput {
  // Identité & localisation
  region?: string;
  prefecture?: string;

  // Membres & gouvernance
  memberCount: number;
  seniorityYears: number;
  separationOfPowers: boolean;
  agHeldRegularly: boolean;
  keepsMinutes: boolean;
  keepsRegisters: boolean;
  trained: boolean;
  participatesInCEP: boolean;

  // Objet du crédit
  creditType: CreditType;
  requestedAmount: number;
  proposedDuration?: number | null;
  proposedDeferral?: number | null;

  // Volet agricole
  cultures: string[];
  totalArea?: number | null;
  yields?: Record<string, number> | null;
  waterAccess: boolean;
  irrigationType: IrrigationType;
  climateHistory: ClimateHistory;
  hasEquipment: boolean;
  laborForce?: number | null;

  // Volet financier
  revenue?: number | null;
  charges?: number | null;
  savings: number;
  memberContribution: number;
  mandatorySavingsUpToDate: boolean;
  liquidityReserveRatio?: number | null;

  // Garanties
  guaranteeValue?: number | null;

  // Historique / risque
  repaymentHistory: RepaymentHistory;
  par30?: number | null;
  previousDefaults: number;
}

/** Contribution détaillée d'une dimension au score global. */
export interface ScoreBreakdownItem {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number; // 0-1
  weightedScore: number; // score * weight
  comment: string;
}

/** Règle bloquante ou alerte déclenchée pendant l'évaluation. */
export interface ScoringFlag {
  code: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
}

/** Bloc de recommandations produit par le moteur. */
export interface Recommendations {
  recommendedAmount: number;
  recommendedDuration: number;
  recommendedDeferral: number;
  recommendedRate: number;
  additionalGuarantees: string[];
  favoredCultures: string[];
  riskyCultures: string[];
  technicalRecommendations: string[];
  financialRecommendations: string[];
  conditions: string[];
}

/** Indicateurs quantitatifs (TDR : Markowitz / VaR / Sharpe). */
export interface QuantIndicators {
  var95: number;
  expectedShortfall: number;
  sharpeRatio: number;
  diversificationIndex: number;
}

/** Résultat complet du moteur de scoring. */
export interface ScoringResult {
  scores: {
    scoreFinancier: number;
    scoreAgricole: number;
    scoreGouvernance: number;
    scoreHistorique: number;
    scoreClimat: number;
    scoreRemboursement: number;
    scoreProduction: number;
    scoreTresorerie: number;
    scoreRentabilite: number;
    scoreRisque: number;
    globalScore: number;
  };
  riskLevel: RiskLevel;
  decision: Decision;
  justification: string;
  breakdown: ScoreBreakdownItem[];
  flags: ScoringFlag[];
  recommendations: Recommendations;
  indicators: QuantIndicators;
  engineVersion: string;
}

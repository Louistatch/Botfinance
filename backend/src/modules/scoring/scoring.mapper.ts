import {
  ClimateHistory,
  CreditType,
  IrrigationType,
  RepaymentHistory,
} from '@prisma/client';
import { ScoringInput } from './scoring.types';

/**
 * Construit un `ScoringInput` complet à partir de données partielles
 * (DTO de simulation ou agrégat coopérative + demande), en appliquant des
 * valeurs par défaut prudentes pour les champs manquants.
 */
export function toScoringInput(src: Partial<ScoringInput> & {
  memberCount: number;
  creditType: CreditType;
  requestedAmount: number;
  savings: number;
  cultures: string[];
}): ScoringInput {
  return {
    region: src.region,
    prefecture: src.prefecture,
    memberCount: src.memberCount,
    seniorityYears: src.seniorityYears ?? 0,
    separationOfPowers: src.separationOfPowers ?? false,
    agHeldRegularly: src.agHeldRegularly ?? false,
    keepsMinutes: src.keepsMinutes ?? false,
    keepsRegisters: src.keepsRegisters ?? false,
    trained: src.trained ?? false,
    participatesInCEP: src.participatesInCEP ?? true,
    creditType: src.creditType,
    requestedAmount: src.requestedAmount,
    proposedDuration: src.proposedDuration ?? null,
    proposedDeferral: src.proposedDeferral ?? null,
    cultures: src.cultures ?? [],
    totalArea: src.totalArea ?? null,
    yields: src.yields ?? null,
    waterAccess: src.waterAccess ?? false,
    irrigationType: src.irrigationType ?? IrrigationType.NONE,
    climateHistory: src.climateHistory ?? ClimateHistory.MODERATE,
    hasEquipment: src.hasEquipment ?? false,
    laborForce: src.laborForce ?? null,
    revenue: src.revenue ?? null,
    charges: src.charges ?? null,
    savings: src.savings,
    memberContribution: src.memberContribution ?? 0,
    mandatorySavingsUpToDate: src.mandatorySavingsUpToDate ?? false,
    liquidityReserveRatio: src.liquidityReserveRatio ?? null,
    guaranteeValue: src.guaranteeValue ?? null,
    repaymentHistory: src.repaymentHistory ?? RepaymentHistory.NONE,
    par30: src.par30 ?? null,
    previousDefaults: src.previousDefaults ?? 0,
  };
}

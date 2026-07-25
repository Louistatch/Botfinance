import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Decision,
  Prisma,
  RequestStatus,
  RequestSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { toScoringInput } from '../scoring/scoring.mapper';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';

@Injectable()
export class CreditRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  private async nextReference(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.creditRequest.count();
    return `DEM-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(dto: CreateCreditRequestDto) {
    const coop = await this.prisma.cooperative.findUnique({
      where: { id: dto.cooperativeId },
    });
    if (!coop) throw new NotFoundException('Coopérative introuvable.');

    const reference = await this.nextReference();
    return this.prisma.creditRequest.create({
      data: {
        reference,
        cooperativeId: dto.cooperativeId,
        creditType: dto.creditType,
        requestedAmount: dto.requestedAmount,
        purpose: dto.purpose,
        proposedDuration: dto.proposedDuration,
        proposedDeferral: dto.proposedDeferral,
        cultures: dto.cultures ?? [],
        totalArea: dto.totalArea,
        yields: dto.yields ?? undefined,
        waterAccess: dto.waterAccess ?? false,
        irrigationType: dto.irrigationType ?? undefined,
        climateHistory: dto.climateHistory ?? undefined,
        hasEquipment: dto.hasEquipment ?? false,
        equipmentList: dto.equipmentList,
        laborForce: dto.laborForce,
        revenue: dto.revenue,
        charges: dto.charges,
        savings: dto.savings ?? 0,
        memberContribution: dto.memberContribution ?? 0,
        mandatorySavingsUpToDate: dto.mandatorySavingsUpToDate ?? false,
        liquidityReserveRatio: dto.liquidityReserveRatio,
        guaranteesDescription: dto.guaranteesDescription,
        guaranteeValue: dto.guaranteeValue,
        repaymentHistory: dto.repaymentHistory ?? undefined,
        par30: dto.par30,
        previousDefaults: dto.previousDefaults ?? 0,
        source: dto.source ?? RequestSource.DASHBOARD,
        submittedByPhone: dto.submittedByPhone,
        status: RequestStatus.SUBMITTED,
      },
      include: { cooperative: true },
    });
  }

  findAll(params: { status?: RequestStatus; cooperativeId?: string }) {
    const where: Prisma.CreditRequestWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.cooperativeId) where.cooperativeId = params.cooperativeId;
    return this.prisma.creditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { cooperative: true, evaluation: true },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.creditRequest.findUnique({
      where: { id },
      include: { cooperative: true, evaluation: true },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    return request;
  }

  /**
   * Exécute le moteur de scoring sur une demande et persiste l'évaluation.
   * Met à jour le statut de la demande selon la décision.
   */
  async evaluate(id: string, evaluatedById?: string) {
    const request = await this.prisma.creditRequest.findUnique({
      where: { id },
      include: { cooperative: true },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    const coop = request.cooperative;

    const input = toScoringInput({
      region: coop.region,
      prefecture: coop.prefecture,
      memberCount: coop.memberCount,
      seniorityYears: coop.seniorityYears,
      separationOfPowers: coop.separationOfPowers,
      agHeldRegularly: coop.agHeldRegularly,
      keepsMinutes: coop.keepsMinutes,
      keepsRegisters: coop.keepsRegisters,
      trained: coop.trained,
      participatesInCEP: coop.participatesInCEP,
      creditType: request.creditType,
      requestedAmount: request.requestedAmount,
      proposedDuration: request.proposedDuration,
      proposedDeferral: request.proposedDeferral,
      cultures: request.cultures,
      totalArea: request.totalArea,
      yields: (request.yields as Record<string, number>) ?? null,
      waterAccess: request.waterAccess,
      irrigationType: request.irrigationType,
      climateHistory: request.climateHistory,
      hasEquipment: request.hasEquipment,
      laborForce: request.laborForce,
      revenue: request.revenue,
      charges: request.charges,
      savings: request.savings,
      memberContribution: request.memberContribution,
      mandatorySavingsUpToDate: request.mandatorySavingsUpToDate,
      liquidityReserveRatio: request.liquidityReserveRatio,
      guaranteeValue: request.guaranteeValue,
      repaymentHistory: request.repaymentHistory,
      par30: request.par30,
      previousDefaults: request.previousDefaults,
    });

    const result = this.scoring.evaluate(input);

    const status =
      result.decision === Decision.ELIGIBLE
        ? RequestStatus.APPROVED
        : result.decision === Decision.CONDITIONAL
          ? RequestStatus.CONDITIONAL
          : RequestStatus.REJECTED;

    const evaluation = await this.prisma.evaluation.upsert({
      where: { creditRequestId: id },
      create: {
        creditRequestId: id,
        ...this.mapScores(result),
        evaluatedById: evaluatedById ?? null,
      },
      update: {
        ...this.mapScores(result),
        evaluatedById: evaluatedById ?? null,
      },
    });

    await this.prisma.creditRequest.update({
      where: { id },
      data: { status },
    });

    return { request: { id, reference: request.reference, status }, evaluation };
  }

  /** Transforme le résultat du moteur en données persistables. */
  private mapScores(result: ReturnType<ScoringService['evaluate']>) {
    return {
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
      breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
      flags: result.flags as unknown as Prisma.InputJsonValue,
      recommendedAmount: result.recommendations.recommendedAmount,
      recommendedDuration: result.recommendations.recommendedDuration,
      recommendedDeferral: result.recommendations.recommendedDeferral,
      recommendedRate: result.recommendations.recommendedRate,
      additionalGuarantees: result.recommendations.additionalGuarantees as unknown as Prisma.InputJsonValue,
      favoredCultures: result.recommendations.favoredCultures as unknown as Prisma.InputJsonValue,
      riskyCultures: result.recommendations.riskyCultures as unknown as Prisma.InputJsonValue,
      technicalRecommendations: result.recommendations.technicalRecommendations as unknown as Prisma.InputJsonValue,
      financialRecommendations: result.recommendations.financialRecommendations as unknown as Prisma.InputJsonValue,
      conditions: result.recommendations.conditions as unknown as Prisma.InputJsonValue,
      var95: result.indicators.var95,
      expectedShortfall: result.indicators.expectedShortfall,
      sharpeRatio: result.indicators.sharpeRatio,
      diversificationIndex: result.indicators.diversificationIndex,
      engineVersion: result.engineVersion,
    };
  }
}

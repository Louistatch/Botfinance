import { Injectable } from '@nestjs/common';
import { Decision, RequestStatus, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** KPIs globaux du tableau de bord. */
  async stats() {
    const [
      totalCooperatives,
      totalRequests,
      byStatus,
      byDecision,
      byRisk,
      amountAgg,
      approvedAmountAgg,
    ] = await Promise.all([
      this.prisma.cooperative.count(),
      this.prisma.creditRequest.count(),
      this.prisma.creditRequest.groupBy({ by: ['status'], _count: true }),
      this.prisma.evaluation.groupBy({ by: ['decision'], _count: true }),
      this.prisma.evaluation.groupBy({ by: ['riskLevel'], _count: true }),
      this.prisma.creditRequest.aggregate({ _sum: { requestedAmount: true } }),
      this.prisma.evaluation.aggregate({
        _sum: { recommendedAmount: true },
        where: { decision: { in: [Decision.ELIGIBLE, Decision.CONDITIONAL] } },
      }),
    ]);

    const statusMap = this.toMap(byStatus, 'status');
    const decisionMap = this.toMap(byDecision, 'decision');
    const riskMap = this.toMap(byRisk, 'riskLevel');

    const accepted =
      (decisionMap[Decision.ELIGIBLE] ?? 0) +
      (decisionMap[Decision.CONDITIONAL] ?? 0);
    const rejected = decisionMap[Decision.REJECTED] ?? 0;
    const evaluated = accepted + rejected;

    return {
      totals: {
        cooperatives: totalCooperatives,
        requests: totalRequests,
        evaluated,
        pending:
          (statusMap[RequestStatus.SUBMITTED] ?? 0) +
          (statusMap[RequestStatus.UNDER_REVIEW] ?? 0) +
          (statusMap[RequestStatus.DRAFT] ?? 0),
      },
      decisions: {
        eligible: decisionMap[Decision.ELIGIBLE] ?? 0,
        conditional: decisionMap[Decision.CONDITIONAL] ?? 0,
        rejected,
        accepted,
        approvalRate: evaluated ? Math.round((accepted / evaluated) * 100) : 0,
      },
      risk: {
        low: riskMap[RiskLevel.LOW] ?? 0,
        medium: riskMap[RiskLevel.MEDIUM] ?? 0,
        high: riskMap[RiskLevel.HIGH] ?? 0,
        veryHigh: riskMap[RiskLevel.VERY_HIGH] ?? 0,
      },
      amounts: {
        totalRequested: amountAgg._sum.requestedAmount ?? 0,
        totalRecommended: approvedAmountAgg._sum.recommendedAmount ?? 0,
        currency: 'FCFA',
      },
      statusBreakdown: statusMap,
    };
  }

  /** Données de cartographie : agrégation par préfecture. */
  async map() {
    const coops = await this.prisma.cooperative.findMany({
      select: {
        region: true,
        prefecture: true,
        village: true,
        creditRequests: {
          select: {
            requestedAmount: true,
            evaluation: { select: { decision: true, globalScore: true } },
          },
        },
      },
    });

    const byPrefecture = new Map<
      string,
      {
        region: string;
        prefecture: string;
        cooperatives: number;
        requests: number;
        totalRequested: number;
        eligible: number;
        avgScore: number;
        _scoreSum: number;
        _scoreCount: number;
      }
    >();

    for (const c of coops) {
      const key = `${c.region}::${c.prefecture}`;
      const entry = byPrefecture.get(key) ?? {
        region: c.region,
        prefecture: c.prefecture,
        cooperatives: 0,
        requests: 0,
        totalRequested: 0,
        eligible: 0,
        avgScore: 0,
        _scoreSum: 0,
        _scoreCount: 0,
      };
      entry.cooperatives += 1;
      for (const r of c.creditRequests) {
        entry.requests += 1;
        entry.totalRequested += r.requestedAmount;
        if (r.evaluation) {
          if (r.evaluation.decision === Decision.ELIGIBLE) entry.eligible += 1;
          entry._scoreSum += r.evaluation.globalScore;
          entry._scoreCount += 1;
        }
      }
      byPrefecture.set(key, entry);
    }

    return Array.from(byPrefecture.values()).map((e) => ({
      region: e.region,
      prefecture: e.prefecture,
      cooperatives: e.cooperatives,
      requests: e.requests,
      totalRequested: e.totalRequested,
      eligible: e.eligible,
      coordinates: this.prefectureCoordinates(e.prefecture),
      avgScore: e._scoreCount ? Math.round(e._scoreSum / e._scoreCount) : 0,
    }));
  }

  /** Données brutes pour les exports (Excel / PDF). */
  async exportRows() {
    const requests = await this.prisma.creditRequest.findMany({
      include: { cooperative: true, evaluation: true },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => ({
      reference: r.reference,
      cooperative: r.cooperative.name,
      region: r.cooperative.region,
      prefecture: r.cooperative.prefecture,
      president: r.cooperative.presidentName,
      creditType: r.creditType,
      requestedAmount: r.requestedAmount,
      purpose: r.purpose,
      status: r.status,
      globalScore: r.evaluation?.globalScore ?? null,
      riskLevel: r.evaluation?.riskLevel ?? null,
      decision: r.evaluation?.decision ?? null,
      recommendedAmount: r.evaluation?.recommendedAmount ?? null,
      recommendedRate: r.evaluation?.recommendedRate ?? null,
      createdAt: r.createdAt,
    }));
  }

  private toMap<T extends Record<string, any>>(
    rows: T[],
    key: keyof T,
  ): Record<string, number> {
    const m: Record<string, number> = {};
    for (const row of rows) m[String(row[key])] = (row as any)._count;
    return m;
  }

  /**
   * Coordonnées indicatives des préfectures cibles (région Kara, ProSMAT).
   * Alimente la cartographie du dashboard.
   */
  private prefectureCoordinates(prefecture: string): { lat: number; lng: number } {
    const table: Record<string, { lat: number; lng: number }> = {
      ASSOLI: { lat: 9.35, lng: 1.15 },
      DANKPEN: { lat: 9.65, lng: 0.65 },
      KOZAH: { lat: 9.55, lng: 1.19 },
      DAOUDE: { lat: 9.4, lng: 1.05 },
      'DAOUDÈ': { lat: 9.4, lng: 1.05 },
      KARA: { lat: 9.55, lng: 1.18 },
    };
    return table[prefecture?.toUpperCase()] ?? { lat: 9.5, lng: 1.1 };
  }
}

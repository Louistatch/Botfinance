import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';

@Injectable()
export class CooperativesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Génère un code lisible et unique (COOP-YYYY-NNNN). */
  private async nextCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.cooperative.count();
    return `COOP-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateCooperativeDto) {
    const code = await this.nextCode();
    return this.prisma.cooperative.create({ data: { ...dto, code } });
  }

  async findAll(params: { region?: string; prefecture?: string; search?: string }) {
    const where: Prisma.CooperativeWhereInput = {};
    if (params.region) where.region = params.region;
    if (params.prefecture) where.prefecture = params.prefecture;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { cepName: { contains: params.search, mode: 'insensitive' } },
        { presidentName: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.cooperative.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { creditRequests: true } } },
    });
  }

  async findOne(id: string) {
    const coop = await this.prisma.cooperative.findUnique({
      where: { id },
      include: {
        creditRequests: {
          orderBy: { createdAt: 'desc' },
          include: { evaluation: true },
        },
      },
    });
    if (!coop) throw new NotFoundException('Coopérative introuvable.');
    return coop;
  }

  async update(id: string, dto: UpdateCooperativeDto) {
    await this.ensureExists(id);
    return this.prisma.cooperative.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.cooperative.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.cooperative.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Coopérative introuvable.');
  }
}

import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { ExportService } from './export.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly exporter: ExportService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'KPIs globaux du tableau de bord.' })
  stats() {
    return this.dashboard.stats();
  }

  @Get('map')
  @ApiOperation({ summary: 'Données de cartographie (agrégation par préfecture).' })
  map() {
    return this.dashboard.map();
  }

  @Get('export/excel')
  @Roles(Role.ADMIN, Role.CREDIT_ANALYST)
  @ApiOperation({ summary: 'Exporter les demandes au format Excel (.xlsx).' })
  async excel(@Res() res: Response) {
    const buffer = await this.exporter.toExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="creditcep-export-${Date.now()}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('export/pdf')
  @Roles(Role.ADMIN, Role.CREDIT_ANALYST)
  @ApiOperation({ summary: 'Exporter un rapport de synthèse au format PDF.' })
  async pdf(@Res() res: Response) {
    const buffer = await this.exporter.toPdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="creditcep-rapport-${Date.now()}.pdf"`,
    );
    res.send(buffer);
  }
}

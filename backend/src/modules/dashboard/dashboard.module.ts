import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ExportService } from './export.service';
import { DashboardController } from './dashboard.controller';

@Module({
  providers: [DashboardService, ExportService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}

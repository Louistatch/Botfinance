import { Module } from '@nestjs/common';
import { CreditRequestsService } from './credit-requests.service';
import { CreditRequestsController } from './credit-requests.controller';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [ScoringModule],
  providers: [CreditRequestsService],
  controllers: [CreditRequestsController],
  exports: [CreditRequestsService],
})
export class CreditRequestsModule {}

import { Module } from '@nestjs/common';
import { CooperativesService } from './cooperatives.service';
import { CooperativesController } from './cooperatives.controller';

@Module({
  providers: [CooperativesService],
  controllers: [CooperativesController],
  exports: [CooperativesService],
})
export class CooperativesModule {}

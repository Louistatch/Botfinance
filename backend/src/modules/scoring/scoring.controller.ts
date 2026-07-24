import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { SimulateScoringDto } from './dto/simulate-scoring.dto';
import { toScoringInput } from './scoring.mapper';

@ApiTags('scoring')
@ApiBearerAuth()
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Post('simulate')
  @ApiOperation({
    summary: 'Simuler une évaluation de crédit sans persistance.',
    description:
      'Exécute le moteur de décision (11 scores, niveau de risque, décision, ' +
      'recommandations) sur un jeu de données fourni. Utile pour le dashboard ' +
      "et les tests d'hypothèses.",
  })
  simulate(@Body() dto: SimulateScoringDto) {
    const input = toScoringInput({
      ...dto,
      seniorityYears: dto.seniorityYears ?? 0,
      memberContribution: dto.memberContribution ?? 0,
    });
    return this.scoring.evaluate(input);
  }
}

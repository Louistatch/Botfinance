import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role, RequestStatus } from '@prisma/client';
import { CreditRequestsService } from './credit-requests.service';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('credit-requests')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('credit-requests')
export class CreditRequestsController {
  constructor(private readonly service: CreditRequestsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.AGENT, Role.CREDIT_ANALYST)
  @ApiOperation({ summary: 'Créer une demande de crédit.' })
  create(@Body() dto: CreateCreditRequestDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les demandes (filtres optionnels).' })
  @ApiQuery({ name: 'status', required: false, enum: RequestStatus })
  @ApiQuery({ name: 'cooperativeId', required: false })
  findAll(
    @Query('status') status?: RequestStatus,
    @Query('cooperativeId') cooperativeId?: string,
  ) {
    return this.service.findAll({ status, cooperativeId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une demande et son évaluation.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/evaluate')
  @Roles(Role.ADMIN, Role.CREDIT_ANALYST)
  @ApiOperation({
    summary: 'Lancer le moteur de scoring sur une demande et persister le résultat.',
  })
  evaluate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.evaluate(id, user?.id);
  }
}

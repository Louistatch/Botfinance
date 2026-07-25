import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CooperativesService } from './cooperatives.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('cooperatives')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('cooperatives')
export class CooperativesController {
  constructor(private readonly service: CooperativesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.AGENT, Role.CREDIT_ANALYST)
  @ApiOperation({ summary: 'Créer une coopérative.' })
  create(@Body() dto: CreateCooperativeDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les coopératives (filtres optionnels).' })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'prefecture', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('region') region?: string,
    @Query('prefecture') prefecture?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ region, prefecture, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une coopérative et ses demandes.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.AGENT, Role.CREDIT_ANALYST)
  @ApiOperation({ summary: 'Mettre à jour une coopérative.' })
  update(@Param('id') id: string, @Body() dto: UpdateCooperativeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer une coopérative (ADMIN).' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

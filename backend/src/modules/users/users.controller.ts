import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les utilisateurs (ADMIN).' })
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un utilisateur (ADMIN).' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Activer / désactiver un utilisateur (ADMIN).' })
  setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.users.setActive(id, active);
  }
}

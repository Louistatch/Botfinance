import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'agent.terrain@creditcep.ai' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Awa Kponton' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, example: Role.AGENT })
  @IsEnum(Role)
  role: Role;
}

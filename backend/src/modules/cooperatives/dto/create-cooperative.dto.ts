import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCooperativeDto {
  @ApiProperty({ example: 'BIBONA DE GANDE' }) @IsString() name: string;
  @ApiPropertyOptional({ example: 'BIBONA DE GANDE' }) @IsOptional() @IsString() cepName?: string;

  @ApiProperty({ example: 'Kara' }) @IsString() region: string;
  @ApiProperty({ example: 'ASSOLI' }) @IsString() prefecture: string;
  @ApiPropertyOptional() @IsOptional() @IsString() commune?: string;
  @ApiPropertyOptional({ example: 'Gande' }) @IsOptional() @IsString() village?: string;

  @ApiProperty({ example: 19 }) @IsInt() @Min(1) memberCount: number;
  @ApiProperty({ example: 'ABIBOU Roukeyatou' }) @IsString() presidentName: string;
  @ApiProperty({ example: '92496314' }) @IsString() presidentPhone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vicePresidentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vicePresidentPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secretaryName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secretaryPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() treasurerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() treasurerPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() treasurerDeputy?: string;
  @ApiProperty({ example: '92496314' }) @IsString() contactPhone: string;

  @ApiPropertyOptional({ example: 2022 }) @IsOptional() @IsInt() creationYear?: number;
  @ApiPropertyOptional({ example: 2 }) @IsOptional() @IsInt() @Min(0) seniorityYears?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() separationOfPowers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() agHeldRegularly?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() keepsMinutes?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() keepsRegisters?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() participatesInCEP?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() trained?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ClimateHistory,
  CreditType,
  IrrigationType,
  RepaymentHistory,
} from '@prisma/client';

/**
 * Corps de requête pour une simulation de scoring sans persistance.
 * Reflète l'ensemble des variables collectées par le bot WhatsApp.
 */
export class SimulateScoringDto {
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prefecture?: string;

  @ApiProperty({ example: 20 }) @IsInt() @Min(1) memberCount: number;
  @ApiPropertyOptional({ example: 2 }) @IsOptional() @IsInt() @Min(0) seniorityYears?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() separationOfPowers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() agHeldRegularly?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() keepsMinutes?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() keepsRegisters?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() trained?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() participatesInCEP?: boolean;

  @ApiProperty({ enum: CreditType, example: CreditType.INTERNAL_FUND })
  @IsEnum(CreditType)
  creditType: CreditType;

  @ApiProperty({ example: 90000 }) @IsNumber() @Min(0) requestedAmount: number;
  @ApiPropertyOptional({ example: 3 }) @IsOptional() @IsInt() proposedDuration?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsInt() proposedDeferral?: number;

  @ApiProperty({ type: [String], example: ['tomate', 'piment', 'oignon'] })
  @IsArray()
  cultures: string[];

  @ApiPropertyOptional({ example: 1.5 }) @IsOptional() @IsNumber() totalArea?: number;
  @ApiPropertyOptional({ example: { tomate: 14000 } }) @IsOptional() yields?: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() waterAccess?: boolean;

  @ApiPropertyOptional({ enum: IrrigationType, example: IrrigationType.DRIP })
  @IsOptional() @IsEnum(IrrigationType)
  irrigationType?: IrrigationType;

  @ApiPropertyOptional({ enum: ClimateHistory, example: ClimateHistory.MODERATE })
  @IsOptional() @IsEnum(ClimateHistory)
  climateHistory?: ClimateHistory;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasEquipment?: boolean;
  @ApiPropertyOptional({ example: 12 }) @IsOptional() @IsInt() laborForce?: number;

  @ApiPropertyOptional({ example: 1500000 }) @IsOptional() @IsNumber() revenue?: number;
  @ApiPropertyOptional({ example: 900000 }) @IsOptional() @IsNumber() charges?: number;
  @ApiProperty({ example: 45000 }) @IsNumber() @Min(0) savings: number;
  @ApiPropertyOptional({ example: 5000 }) @IsOptional() @IsNumber() memberContribution?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatorySavingsUpToDate?: boolean;
  @ApiPropertyOptional({ example: 0.25 }) @IsOptional() @IsNumber() liquidityReserveRatio?: number;

  @ApiPropertyOptional({ example: 60000 }) @IsOptional() @IsNumber() guaranteeValue?: number;

  @ApiPropertyOptional({ enum: RepaymentHistory, example: RepaymentHistory.GOOD })
  @IsOptional() @IsEnum(RepaymentHistory)
  repaymentHistory?: RepaymentHistory;

  @ApiPropertyOptional({ example: 0.05 }) @IsOptional() @IsNumber() par30?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsInt() previousDefaults?: number;
}

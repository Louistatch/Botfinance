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
  RequestSource,
} from '@prisma/client';

export class CreateCreditRequestDto {
  @ApiProperty() @IsString() cooperativeId: string;

  @ApiProperty({ enum: CreditType, example: CreditType.INTERNAL_FUND })
  @IsEnum(CreditType)
  creditType: CreditType;

  @ApiProperty({ example: 90000 }) @IsNumber() @Min(0) requestedAmount: number;
  @ApiProperty({ example: 'Achat de semences et kit d’irrigation' }) @IsString() purpose: string;
  @ApiPropertyOptional({ example: 3 }) @IsOptional() @IsInt() proposedDuration?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsInt() proposedDeferral?: number;

  @ApiProperty({ type: [String], example: ['tomate', 'piment', 'oignon'] })
  @IsArray()
  cultures: string[];

  @ApiPropertyOptional({ example: 1.5 }) @IsOptional() @IsNumber() totalArea?: number;
  @ApiPropertyOptional({ example: { tomate: 14000, piment: 7000 } })
  @IsOptional()
  yields?: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() waterAccess?: boolean;
  @ApiPropertyOptional({ enum: IrrigationType }) @IsOptional() @IsEnum(IrrigationType) irrigationType?: IrrigationType;
  @ApiPropertyOptional({ enum: ClimateHistory }) @IsOptional() @IsEnum(ClimateHistory) climateHistory?: ClimateHistory;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasEquipment?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() equipmentList?: string;
  @ApiPropertyOptional({ example: 12 }) @IsOptional() @IsInt() laborForce?: number;

  @ApiPropertyOptional({ example: 1500000 }) @IsOptional() @IsNumber() revenue?: number;
  @ApiPropertyOptional({ example: 900000 }) @IsOptional() @IsNumber() charges?: number;
  @ApiProperty({ example: 45000 }) @IsNumber() @Min(0) savings: number;
  @ApiPropertyOptional({ example: 5000 }) @IsOptional() @IsNumber() memberContribution?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatorySavingsUpToDate?: boolean;
  @ApiPropertyOptional({ example: 0.25 }) @IsOptional() @IsNumber() liquidityReserveRatio?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() guaranteesDescription?: string;
  @ApiPropertyOptional({ example: 60000 }) @IsOptional() @IsNumber() guaranteeValue?: number;

  @ApiPropertyOptional({ enum: RepaymentHistory }) @IsOptional() @IsEnum(RepaymentHistory) repaymentHistory?: RepaymentHistory;
  @ApiPropertyOptional({ example: 0.05 }) @IsOptional() @IsNumber() par30?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsInt() previousDefaults?: number;

  @ApiPropertyOptional({ enum: RequestSource }) @IsOptional() @IsEnum(RequestSource) source?: RequestSource;
  @ApiPropertyOptional() @IsOptional() @IsString() submittedByPhone?: string;
}

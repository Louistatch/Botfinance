-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CREDIT_ANALYST', 'AGENT');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('INTERNAL_FUND', 'EXTERNAL_WAGES');

-- CreateEnum
CREATE TYPE "IrrigationType" AS ENUM ('NONE', 'MANUAL', 'GRAVITY', 'MOTOR_PUMP', 'CALIFORNIAN', 'DRIP');

-- CreateEnum
CREATE TYPE "ClimateHistory" AS ENUM ('STABLE', 'MODERATE', 'UNSTABLE', 'SEVERE');

-- CreateEnum
CREATE TYPE "RepaymentHistory" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'NONE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'EVALUATED', 'APPROVED', 'CONDITIONAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('WHATSAPP', 'DASHBOARD', 'API');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('ELIGIBLE', 'CONDITIONAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "WaterNeed" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperatives" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cepName" TEXT,
    "region" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "commune" TEXT,
    "village" TEXT,
    "memberCount" INTEGER NOT NULL,
    "presidentName" TEXT NOT NULL,
    "presidentPhone" TEXT NOT NULL,
    "vicePresidentName" TEXT,
    "vicePresidentPhone" TEXT,
    "secretaryName" TEXT,
    "secretaryPhone" TEXT,
    "treasurerName" TEXT,
    "treasurerPhone" TEXT,
    "treasurerDeputy" TEXT,
    "contactPhone" TEXT NOT NULL,
    "creationYear" INTEGER,
    "seniorityYears" INTEGER NOT NULL DEFAULT 0,
    "separationOfPowers" BOOLEAN NOT NULL DEFAULT false,
    "agHeldRegularly" BOOLEAN NOT NULL DEFAULT false,
    "keepsMinutes" BOOLEAN NOT NULL DEFAULT false,
    "keepsRegisters" BOOLEAN NOT NULL DEFAULT false,
    "participatesInCEP" BOOLEAN NOT NULL DEFAULT true,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "creditType" "CreditType" NOT NULL DEFAULT 'INTERNAL_FUND',
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "proposedDuration" INTEGER,
    "proposedDeferral" INTEGER,
    "cultures" TEXT[],
    "totalArea" DOUBLE PRECISION,
    "yields" JSONB,
    "waterAccess" BOOLEAN NOT NULL DEFAULT false,
    "irrigationType" "IrrigationType" NOT NULL DEFAULT 'NONE',
    "climateHistory" "ClimateHistory" NOT NULL DEFAULT 'MODERATE',
    "hasEquipment" BOOLEAN NOT NULL DEFAULT false,
    "equipmentList" TEXT,
    "laborForce" INTEGER,
    "revenue" DOUBLE PRECISION,
    "charges" DOUBLE PRECISION,
    "savings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memberContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mandatorySavingsUpToDate" BOOLEAN NOT NULL DEFAULT false,
    "liquidityReserveRatio" DOUBLE PRECISION,
    "guaranteesDescription" TEXT,
    "guaranteeValue" DOUBLE PRECISION,
    "repaymentHistory" "RepaymentHistory" NOT NULL DEFAULT 'NONE',
    "par30" DOUBLE PRECISION,
    "previousDefaults" INTEGER NOT NULL DEFAULT 0,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "RequestSource" NOT NULL DEFAULT 'WHATSAPP',
    "submittedByPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "creditRequestId" TEXT NOT NULL,
    "scoreFinancier" DOUBLE PRECISION NOT NULL,
    "scoreAgricole" DOUBLE PRECISION NOT NULL,
    "scoreGouvernance" DOUBLE PRECISION NOT NULL,
    "scoreHistorique" DOUBLE PRECISION NOT NULL,
    "scoreClimat" DOUBLE PRECISION NOT NULL,
    "scoreRemboursement" DOUBLE PRECISION NOT NULL,
    "scoreProduction" DOUBLE PRECISION NOT NULL,
    "scoreTresorerie" DOUBLE PRECISION NOT NULL,
    "scoreRentabilite" DOUBLE PRECISION NOT NULL,
    "scoreRisque" DOUBLE PRECISION NOT NULL,
    "globalScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "decision" "Decision" NOT NULL,
    "justification" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "recommendedAmount" DOUBLE PRECISION NOT NULL,
    "recommendedDuration" INTEGER NOT NULL,
    "recommendedDeferral" INTEGER NOT NULL,
    "recommendedRate" DOUBLE PRECISION NOT NULL,
    "additionalGuarantees" JSONB NOT NULL,
    "favoredCultures" JSONB NOT NULL,
    "riskyCultures" JSONB NOT NULL,
    "technicalRecommendations" JSONB NOT NULL,
    "financialRecommendations" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "var95" DOUBLE PRECISION,
    "expectedShortfall" DOUBLE PRECISION,
    "sharpeRatio" DOUBLE PRECISION,
    "diversificationIndex" DOUBLE PRECISION,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "evaluatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'START',
    "data" JSONB NOT NULL DEFAULT '{}',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "cooperativeId" TEXT,
    "lastRequestId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culture_references" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "avgYield" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "volatility" DOUBLE PRECISION NOT NULL,
    "cycleMonths" INTEGER NOT NULL,
    "waterNeed" "WaterNeed" NOT NULL DEFAULT 'MEDIUM',
    "agroEco" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "culture_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cooperatives_code_key" ON "cooperatives"("code");

-- CreateIndex
CREATE INDEX "cooperatives_region_prefecture_idx" ON "cooperatives"("region", "prefecture");

-- CreateIndex
CREATE UNIQUE INDEX "credit_requests_reference_key" ON "credit_requests"("reference");

-- CreateIndex
CREATE INDEX "credit_requests_status_idx" ON "credit_requests"("status");

-- CreateIndex
CREATE INDEX "credit_requests_cooperativeId_idx" ON "credit_requests"("cooperativeId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_creditRequestId_key" ON "evaluations"("creditRequestId");

-- CreateIndex
CREATE INDEX "evaluations_decision_idx" ON "evaluations"("decision");

-- CreateIndex
CREATE INDEX "evaluations_riskLevel_idx" ON "evaluations"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_phone_key" ON "whatsapp_conversations"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "culture_references_name_key" ON "culture_references"("name");

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "cooperatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_creditRequestId_fkey" FOREIGN KEY ("creditRequestId") REFERENCES "credit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

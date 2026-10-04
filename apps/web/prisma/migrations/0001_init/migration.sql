-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('is24', 'immowelt', 'manual');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'house', 'multi_family');

-- CreateEnum
CREATE TYPE "StatusKind" AS ENUM ('open', 'excluded', 'closed');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "title" TEXT,
    "propertyType" "PropertyType" NOT NULL,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "livingArea" DECIMAL(8,2) NOT NULL,
    "rooms" DECIMAL(4,1),
    "hausgeldMonthly" DECIMAL(10,2),
    "actualColdRentMonthly" DECIMAL(10,2),
    "rentOverrideMonthly" DECIMAL(10,2),
    "brokerFeeOverride" DECIMAL(6,5),
    "renovationCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "yearBuilt" INTEGER,
    "statusId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "excludedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySnapshot" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DECIMAL(12,2) NOT NULL,
    "fields" JSONB NOT NULL,

    CONSTRAINT "PropertySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromStatusId" TEXT,
    "toStatusId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "StatusKind" NOT NULL DEFAULT 'open',

    CONSTRAINT "PipelineStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "assumptions" JSONB NOT NULL,
    "apiToken" TEXT NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferTaxRate" (
    "state" TEXT NOT NULL,
    "rate" DECIMAL(6,5) NOT NULL,
    "validFrom" DATE,
    "verifiedOn" DATE,
    "source" TEXT,

    CONSTRAINT "TransferTaxRate_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "CityState" (
    "cityKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "CityState_pkey" PRIMARY KEY ("cityKey")
);

-- CreateTable
CREATE TABLE "RentReference" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "sizeMin" DECIMAL(8,2) NOT NULL,
    "sizeMax" DECIMAL(8,2),
    "eurPerM2" DECIMAL(8,2) NOT NULL,
    "source" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "RentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_statusId_idx" ON "Property"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_source_externalId_key" ON "Property"("source", "externalId");

-- CreateIndex
CREATE INDEX "PropertySnapshot_propertyId_capturedAt_idx" ON "PropertySnapshot"("propertyId", "capturedAt");

-- CreateIndex
CREATE INDEX "StatusEvent_propertyId_at_idx" ON "StatusEvent"("propertyId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStatus_name_key" ON "PipelineStatus"("name");

-- CreateIndex
CREATE INDEX "RentReference_city_idx" ON "RentReference"("city");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PipelineStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySnapshot" ADD CONSTRAINT "PropertySnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "PipelineStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "PipelineStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('RECEIPT_INTAKE', 'ORDER', 'MANUAL', 'INITIAL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SALE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCARDED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "category" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "source" "ReferenceType",
    "sourceId" TEXT,
    "unitCost" DECIMAL(65,30),
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "counterpartyId" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "ReferenceType",
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeDraft" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "blobUrl" TEXT NOT NULL,
    "ocrJson" JSONB NOT NULL,
    "parsedJson" JSONB NOT NULL,
    "matchSuggestions" JSONB NOT NULL,
    "status" "DraftStatus" NOT NULL,
    "confirmedOrderId" TEXT,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_orgId_name_idx" ON "Product"("orgId", "name");

-- CreateIndex
CREATE INDEX "Product_orgId_archived_idx" ON "Product"("orgId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Product_orgId_sku_key" ON "Product"("orgId", "sku");

-- CreateIndex
CREATE INDEX "InventoryMovement_orgId_productId_occurredAt_idx" ON "InventoryMovement"("orgId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_orgId_occurredAt_idx" ON "InventoryMovement"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "Order_orgId_type_occurredAt_idx" ON "Order"("orgId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "IntakeDraft_orgId_status_createdAt_idx" ON "IntakeDraft"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeDraft_orgId_userId_status_idx" ON "IntakeDraft"("orgId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeDraft_confirmedOrderId_key" ON "IntakeDraft"("confirmedOrderId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeDraft" ADD CONSTRAINT "IntakeDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "Video" ADD COLUMN "structuredSummaryJson" TEXT;
ALTER TABLE "Video" ADD COLUMN "productName" TEXT;
ALTER TABLE "Video" ADD COLUMN "niche" TEXT;
ALTER TABLE "Video" ADD COLUMN "structuredSummaryImportedAt" DATETIME;

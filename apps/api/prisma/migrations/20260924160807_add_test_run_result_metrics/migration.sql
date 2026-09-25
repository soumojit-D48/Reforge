-- AlterTable
ALTER TABLE "TestRunResult" ADD COLUMN     "costDelta" DECIMAL(10,6),
ADD COLUMN     "errorReason" TEXT,
ADD COLUMN     "failureCategories" JSONB,
ADD COLUMN     "latencyDeltaMs" INTEGER,
ADD COLUMN     "scoreDelta" DOUBLE PRECISION;

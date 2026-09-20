-- AlterTable
ALTER TABLE "FinancialStatement" ADD COLUMN "cashAndEquivalents" DECIMAL;

-- AlterTable
ALTER TABLE "ScreeningResult" ADD COLUMN "cashToMarketCap" DECIMAL;
ALTER TABLE "ScreeningResult" ADD COLUMN "per" DECIMAL;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN "forwardDividendPerShare" DECIMAL;

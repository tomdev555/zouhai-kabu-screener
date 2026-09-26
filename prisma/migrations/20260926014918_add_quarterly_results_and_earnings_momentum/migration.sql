-- AlterTable
ALTER TABLE "ScreeningResult" ADD COLUMN "earningsMomentumScore" DECIMAL;

-- CreateTable
CREATE TABLE "QuarterlyResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "revenue" DECIMAL,
    "profit" DECIMAL,
    CONSTRAINT "QuarterlyResult_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuarterlyResult_stockCode_periodEnd_idx" ON "QuarterlyResult"("stockCode", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyResult_stockCode_periodEnd_key" ON "QuarterlyResult"("stockCode", "periodEnd");

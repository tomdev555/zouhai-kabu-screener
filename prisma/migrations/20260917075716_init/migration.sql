-- CreateTable
CREATE TABLE "Stock" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEnglish" TEXT,
    "market" TEXT,
    "sector33" TEXT,
    "sector17" TEXT,
    "currentPrice" DECIMAL,
    "per" DECIMAL,
    "pbr" DECIMAL,
    "marketCap" DECIMAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" DECIMAL NOT NULL,
    "high" DECIMAL NOT NULL,
    "low" DECIMAL NOT NULL,
    "close" DECIMAL NOT NULL,
    "volume" BIGINT NOT NULL,
    CONSTRAINT "PriceDaily_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialStatement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriodEndDate" DATETIME NOT NULL,
    "eps" DECIMAL,
    "bps" DECIMAL,
    "netSales" DECIMAL,
    "operatingProfit" DECIMAL,
    "ordinaryProfit" DECIMAL,
    "netIncome" DECIMAL,
    "totalAssets" DECIMAL,
    "netAssets" DECIMAL,
    "equityRatio" DECIMAL,
    "interestBearingDebt" DECIMAL,
    "isForecast" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FinancialStatement_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DividendRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "dividendPerShare" DECIMAL NOT NULL,
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    CONSTRAINT "DividendRecord_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScreeningRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criteria" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ScreeningResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screeningRunId" INTEGER NOT NULL,
    "stockCode" TEXT NOT NULL,
    "dividendYield" DECIMAL,
    "epsTrendScore" DECIMAL,
    "dividendCutFreeYears" INTEGER,
    "equityRatio" DECIMAL,
    "yieldRangePercentile" DECIMAL,
    "passedAllRules" BOOLEAN NOT NULL DEFAULT false,
    "compositeScore" DECIMAL,
    "rank" INTEGER,
    "ruleBreakdown" TEXT,
    CONSTRAINT "ScreeningResult_screeningRunId_fkey" FOREIGN KEY ("screeningRunId") REFERENCES "ScreeningRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScreeningResult_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "WatchlistItem_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "accountName" TEXT,
    "buyDate" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyPrice" DECIMAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DividendReceipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "holdingId" INTEGER NOT NULL,
    "paidDate" DATETIME NOT NULL,
    "amountPerShare" DECIMAL NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "DividendReceipt_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Stock_sector33_idx" ON "Stock"("sector33");

-- CreateIndex
CREATE INDEX "PriceDaily_stockCode_date_idx" ON "PriceDaily"("stockCode", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceDaily_stockCode_date_key" ON "PriceDaily"("stockCode", "date");

-- CreateIndex
CREATE INDEX "FinancialStatement_stockCode_fiscalYear_idx" ON "FinancialStatement"("stockCode", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStatement_stockCode_fiscalYear_key" ON "FinancialStatement"("stockCode", "fiscalYear");

-- CreateIndex
CREATE INDEX "DividendRecord_stockCode_fiscalYear_idx" ON "DividendRecord"("stockCode", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "DividendRecord_stockCode_fiscalYear_key" ON "DividendRecord"("stockCode", "fiscalYear");

-- CreateIndex
CREATE INDEX "ScreeningResult_screeningRunId_rank_idx" ON "ScreeningResult"("screeningRunId", "rank");

-- CreateIndex
CREATE INDEX "ScreeningResult_stockCode_idx" ON "ScreeningResult"("stockCode");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_stockCode_key" ON "WatchlistItem"("stockCode");

-- CreateIndex
CREATE INDEX "Holding_stockCode_idx" ON "Holding"("stockCode");

-- CreateIndex
CREATE INDEX "DividendReceipt_holdingId_idx" ON "DividendReceipt"("holdingId");

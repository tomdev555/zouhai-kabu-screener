-- CreateTable
CREATE TABLE "CompanyProfile" (
    "stockCode" TEXT NOT NULL PRIMARY KEY,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceJson" TEXT,
    CONSTRAINT "CompanyProfile_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

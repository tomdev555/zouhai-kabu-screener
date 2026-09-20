-- CreateTable
CREATE TABLE "AiReview" (
    "stockCode" TEXT NOT NULL PRIMARY KEY,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "rankAtTime" INTEGER,
    "content" TEXT NOT NULL,
    "rawText" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    CONSTRAINT "AiReview_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

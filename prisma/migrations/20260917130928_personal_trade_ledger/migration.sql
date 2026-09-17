/*
  Warnings:

  - You are about to drop the `Holding` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `holdingId` on the `DividendReceipt` table. All the data in the column will be lost.
  - Added the required column `quantity` to the `DividendReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stockCode` to the `DividendReceipt` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Holding_stockCode_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Holding";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "fee" DECIMAL NOT NULL DEFAULT 0,
    "accountName" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockNote" (
    "stockCode" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockNote_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DividendReceipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "paidDate" DATETIME NOT NULL,
    "amountPerShare" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DividendReceipt_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DividendReceipt" ("amountPerShare", "id", "note", "paidDate", "totalAmount") SELECT "amountPerShare", "id", "note", "paidDate", "totalAmount" FROM "DividendReceipt";
DROP TABLE "DividendReceipt";
ALTER TABLE "new_DividendReceipt" RENAME TO "DividendReceipt";
CREATE INDEX "DividendReceipt_stockCode_paidDate_idx" ON "DividendReceipt"("stockCode", "paidDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Trade_stockCode_tradeDate_idx" ON "Trade"("stockCode", "tradeDate");

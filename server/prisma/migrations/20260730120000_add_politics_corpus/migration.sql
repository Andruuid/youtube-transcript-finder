-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "uploadsPlaylistId" TEXT;

-- CreateTable
CREATE TABLE "PoliticsChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PoliticsChannel_channelId_fkey"
      FOREIGN KEY ("channelId") REFERENCES "Channel" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PoliticsChannel_channelId_key"
ON "PoliticsChannel"("channelId");

-- CreateIndex
CREATE INDEX "PoliticsChannel_side_position_idx"
ON "PoliticsChannel"("side", "position");

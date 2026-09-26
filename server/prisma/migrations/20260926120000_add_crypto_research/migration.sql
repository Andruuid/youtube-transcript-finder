CREATE TABLE "CryptoAnalysis" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "videoId" INTEGER NOT NULL, "channelId" INTEGER NOT NULL,
  "transcriptHash" TEXT NOT NULL, "model" TEXT NOT NULL, "promptVersion" TEXT NOT NULL,
  "relevant" BOOLEAN NOT NULL, "resultJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CryptoAnalysis_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CryptoAnalysis_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CryptoCalibration" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "channelId" INTEGER NOT NULL, "version" INTEGER NOT NULL,
  "coverageHash" TEXT NOT NULL, "profileJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CryptoCalibration_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CryptoChannelSettings" (
  "channelId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "overridesJson" TEXT NOT NULL DEFAULT '{}', "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CryptoChannelSettings_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CryptoJob" (
  "id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued',
  "paramsJson" TEXT NOT NULL, "checkpointJson" TEXT NOT NULL DEFAULT '{}', "message" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "CryptoJobItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "jobId" TEXT NOT NULL, "youtubeVideoId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0, "error" TEXT, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CryptoJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CryptoJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CryptoCandle" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "asset" TEXT NOT NULL, "day" DATETIME NOT NULL,
  "open" REAL NOT NULL, "high" REAL NOT NULL, "low" REAL NOT NULL, "close" REAL NOT NULL, "volume" REAL NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'coinbase', "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CryptoPriceWindow" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "asset" TEXT NOT NULL, "start" DATETIME NOT NULL, "end" DATETIME NOT NULL,
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CryptoAnalysis_channelId_createdAt_idx" ON "CryptoAnalysis"("channelId", "createdAt");
CREATE UNIQUE INDEX "CryptoAnalysis_videoId_transcriptHash_model_promptVersion_key" ON "CryptoAnalysis"("videoId", "transcriptHash", "model", "promptVersion");
CREATE UNIQUE INDEX "CryptoCalibration_channelId_version_key" ON "CryptoCalibration"("channelId", "version");
CREATE INDEX "CryptoJob_status_createdAt_idx" ON "CryptoJob"("status", "createdAt");
CREATE UNIQUE INDEX "CryptoJobItem_jobId_youtubeVideoId_key" ON "CryptoJobItem"("jobId", "youtubeVideoId");
CREATE UNIQUE INDEX "CryptoCandle_asset_day_key" ON "CryptoCandle"("asset", "day");
CREATE UNIQUE INDEX "CryptoPriceWindow_asset_start_end_key" ON "CryptoPriceWindow"("asset", "start", "end");

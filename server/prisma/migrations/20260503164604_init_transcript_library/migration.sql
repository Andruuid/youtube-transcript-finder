-- CreateTable
CREATE TABLE "Channel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "youtubeChannelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Video" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "youtubeVideoId" TEXT NOT NULL,
    "channelId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "thumbnailUrl" TEXT,
    "hasTranscript" BOOLEAN NOT NULL DEFAULT false,
    "transcriptText" TEXT,
    "transcriptFetchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_youtubeChannelId_key" ON "Channel"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "Channel_title_idx" ON "Channel"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Video_youtubeVideoId_key" ON "Video"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "Video_channelId_publishedAt_idx" ON "Video"("channelId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Video_hasTranscript_idx" ON "Video"("hasTranscript");

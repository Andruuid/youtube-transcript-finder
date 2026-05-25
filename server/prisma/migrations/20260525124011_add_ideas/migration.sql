-- CreateTable
CREATE TABLE "Idea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelTitle" TEXT NOT NULL,
    "videoTitle" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "youtubeVideoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Idea_youtubeVideoId_key" ON "Idea"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "Idea_createdAt_idx" ON "Idea"("createdAt" DESC);

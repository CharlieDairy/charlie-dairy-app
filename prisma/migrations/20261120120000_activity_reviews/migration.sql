-- CreateTable
CREATE TABLE "ActivityReview" (
    "day" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReview_pkey" PRIMARY KEY ("day")
);

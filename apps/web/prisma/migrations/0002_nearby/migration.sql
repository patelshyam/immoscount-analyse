-- CreateTable
CREATE TABLE "NearbyLookup" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "displayName" TEXT NOT NULL,
    "precision" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearbyLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NearbyLookup_queryKey_key" ON "NearbyLookup"("queryKey");


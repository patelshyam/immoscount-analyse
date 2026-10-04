-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "nearbyLookupId" TEXT;

-- CreateIndex
CREATE INDEX "NearbyLookup_lat_lon_idx" ON "NearbyLookup"("lat", "lon");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_nearbyLookupId_fkey" FOREIGN KEY ("nearbyLookupId") REFERENCES "NearbyLookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;


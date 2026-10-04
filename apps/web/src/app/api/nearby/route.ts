import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { lookupNearby } from '@/lib/nearby/lookup';
import { OsmError } from '@/lib/nearby/osm';

const body = z.object({
  address: z.string().trim().min(3).max(300),
  refresh: z.boolean().default(false),
  /** link the result to this property (property page) */
  propertyId: z.string().min(1).max(100).optional(),
});

/** Geocode an address and list amenities within 2 km (else the nearest) — cached. */
export const POST = guarded(async (req) => {
  const data = await parseBody(req, body);
  if (data instanceof Response) return data;
  try {
    const result = await lookupNearby(data.address, data);
    return result
      ? Response.json({ result })
      : Response.json(
          { error: 'Address not found — check street, PLZ and city.' },
          { status: 404 },
        );
  } catch (e) {
    if (e instanceof OsmError) return Response.json({ error: e.message }, { status: 502 });
    throw e;
  }
});

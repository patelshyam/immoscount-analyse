import { analyze } from '@immo/calc';
import { propertyInputSchema } from '@immo/data';
import { guarded, parseBody } from '@/lib/auth';
import { loadAssumptions, loadReference, stateForCity } from '@/lib/reference';

export const POST = guarded(async (req) => {
  const input = await parseBody(req, propertyInputSchema);
  if (input instanceof Response) return input;
  const state = input.state ?? (await stateForCity(input.city));
  const [assumptions, ref] = await Promise.all([loadAssumptions(), loadReference()]);
  return Response.json({ analysis: analyze({ ...input, state }, assumptions, ref) });
});

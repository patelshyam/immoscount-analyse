/** Rent reference size bands in m²: min inclusive, max exclusive, null = open-ended. */
export const SIZE_BANDS = [
  { label: '<40', min: 0, max: 40 },
  { label: '40–60', min: 40, max: 60 },
  { label: '60–80', min: 60, max: 80 },
  { label: '80–100', min: 80, max: 100 },
  { label: '>100', min: 100, max: null },
] as const;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { seed } = await import('./lib/seed');
  try {
    await seed();
  } catch (err) {
    // App still starts; /api/health reports db: false.
    console.error('[seed] failed:', err);
  }
}

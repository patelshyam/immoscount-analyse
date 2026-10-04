'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const db = /database|prisma|ECONNREFUSED|connect/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-lg border border-red-200 bg-white p-6 text-sm">
      <h1 className="text-lg font-semibold text-red-800">Something went wrong</h1>
      <p className="text-slate-700">
        {db
          ? 'The database is not reachable. Is the db container running? (docker compose up -d db)'
          : 'An unexpected error occurred while loading this page.'}
      </p>
      {error.digest && <p className="text-xs text-slate-500">Error id: {error.digest}</p>}
      <button onClick={reset} className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white">
        Try again
      </button>
    </div>
  );
}

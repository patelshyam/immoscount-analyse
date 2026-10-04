import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-3 p-10 text-center text-sm">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-slate-600">
        This page or link doesn&apos;t exist, was revoked, or has expired.
      </p>
      <Link href="/" className="underline">
        Go to the dashboard
      </Link>
    </main>
  );
}

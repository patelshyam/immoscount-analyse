import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  ['/', 'Dashboard'],
  ['/pipeline', 'Pipeline'],
  ['/calculator', 'Calculator'],
  ['/cities', 'Cities'],
  ['/data', 'Data'],
  ['/settings', 'Settings'],
] as const;

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
          <span className="font-semibold whitespace-nowrap">immo-analyzer</span>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="text-slate-600 hover:text-slate-900">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </>
  );
}

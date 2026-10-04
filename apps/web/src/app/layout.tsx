import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: 'immo-analyzer' };

const NAV = [
  ['/', 'Dashboard'],
  ['/calculator', 'Calculator'],
  ['/settings', 'Settings'],
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 text-sm">
            <span className="font-semibold">immo-analyzer</span>
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-slate-600 hover:text-slate-900">
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-slate-500">
          Estimates only — not financial, tax or investment advice.
        </footer>
      </body>
    </html>
  );
}

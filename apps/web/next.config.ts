import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// The single .env lives at the repo root; in Docker env comes from compose instead.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@immo/calc', '@immo/data'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/share/:token*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default config;

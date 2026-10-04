import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'immo-analyzer',
    description: 'Rental yield analysis for listings you open on ImmoScout24 and Immowelt.',
    permissions: ['storage'],
    host_permissions: [
      'https://www.immobilienscout24.de/*',
      'https://www.immowelt.de/*',
      'http://127.0.0.1:3000/*',
      'http://localhost:3000/*',
      // 3001: dev machine where another project already holds 3000 (DECISIONS #23)
      'http://127.0.0.1:3001/*',
      'http://localhost:3001/*',
    ],
  },
});

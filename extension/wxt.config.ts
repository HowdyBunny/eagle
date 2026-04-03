import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Eagle - Headhunter AI',
    description: 'AI-powered candidate collection and evaluation for headhunters',
    permissions: ['storage'],
    host_permissions: [
      'https://www.linkedin.com/*',
      'https://www.liepin.com/*',
      'http://localhost:8000/*',
      'http://127.0.0.1:8000/*',
    ],
  },
});

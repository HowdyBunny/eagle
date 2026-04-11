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
      'http://localhost:52777/*',
      'http://127.0.0.1:52777/*',
    ],
    web_accessible_resources: [
      {
        resources: ['icon/*.png'],
        matches: ['https://www.linkedin.com/*', 'https://www.liepin.com/*'],
      },
    ],
  },
});

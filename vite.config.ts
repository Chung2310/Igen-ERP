import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';
import {configDefaults, defineConfig} from 'vitest/config';
import { resolvePublicWebsiteUrl } from './src/config/publicWebsiteUrl';

export default defineConfig(({ mode }) => {
  const publicEnv = loadEnv(mode, process.cwd(), ['APP_URL', 'VITE_APP_URL']);
  const configuredUrl = publicEnv.VITE_APP_URL?.trim() || publicEnv.APP_URL?.trim() || '';
  const htmlUrl = resolvePublicWebsiteUrl(configuredUrl).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return {
    // Only expose the public website URL; server credentials remain server-only.
    define: {
      __ERP_PUBLIC_WEBSITE_URL__: JSON.stringify(configuredUrl),
    },
    plugins: [react(), tailwindcss(), {
      name: 'public-website-url',
      transformIndexHtml: (html) => html.replaceAll('%PUBLIC_WEBSITE_URL%', htmlUrl),
    }],
    // Tailwind CSS v4 is handled by @tailwindcss/vite. Defining PostCSS here
    // prevents Vite from walking above the repository and loading an unrelated
    // postcss.config.* file from a parent directory.
    css: {
      postcss: {
        plugins: [],
      },
    },
    test: {
      exclude: [
        ...configDefaults.exclude,
        '**/.worktrees/**',
        '**/.claude/worktrees/**',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
        '/uploads': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/tmp/**', '**/dist/**', '**/dist-server/**'] },
    },
  };
});

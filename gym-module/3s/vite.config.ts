import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'frontend',
  base: '/chuoi-gym/',
  plugins: [tailwindcss(), react()],
  css: {
    postcss: {},
  },
  build: { outDir: '../../../dist/chuoi-gym', emptyOutDir: true },
});

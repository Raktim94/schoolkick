import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3847' }, open: '/app/' },
  build: { target: 'es2022', sourcemap: false },
});

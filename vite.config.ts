import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), glsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

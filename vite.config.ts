import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), glsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/sdo': {
        target: 'https://sol24.net/data',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sdo/, ''),
        secure: false,
      },
      '/api/nasa-sdo': {
        target: 'https://sdo.gsfc.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nasa-sdo/, ''),
        secure: false,
      },
      '/api/swpc': {
        target: 'https://services.swpc.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/swpc/, ''),
        secure: false,
      },
    },
  },
});

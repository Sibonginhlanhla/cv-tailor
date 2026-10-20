import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api calls go to the Azure Functions host (func start) on port 7071.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:7071' } },
});

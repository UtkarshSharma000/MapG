import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true, // Allows network access to your Ampere server
      allowedHosts: ["srinivasa.2bd.net", "Srinivasa.2bd.net", "localhost", "127.0.0.1"], // Prevents host blocking errors on custom subdomains like Srinivasa.2bd.net
      
      // Update this section right here:
      hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

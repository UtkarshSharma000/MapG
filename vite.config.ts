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
      allowedHosts: ['greninja.2bd.net'], // Prevents the host blocking error
      
      // Update this section right here:
      hmr: {
        host: 'greninja.2bd.net',
        clientPort: 80, // Forces the WebSocket to connect through standard web traffic
      },
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

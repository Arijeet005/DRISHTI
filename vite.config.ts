import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import {defineConfig, type Plugin} from 'vite';
import {apiRouter, mlRouter} from './src/server/routes';

const apiApp = express();
apiApp.use(express.json());
apiApp.use('/api', apiRouter);
apiApp.use('/ml', mlRouter);

function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api') || req.url?.startsWith('/ml')) {
          apiApp(req as any, res as any, next);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

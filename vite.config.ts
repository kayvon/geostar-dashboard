import { defineConfig, build, type Plugin, type ViteDevServer } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const CLIENT_CONFIG = 'vite.client.config.ts';

function clientBuildPlugin(): Plugin {
  return {
    name: 'build-client',
    configureServer(server: ViteDevServer) {
      build({ configFile: CLIENT_CONFIG, logLevel: 'warn' });
      server.watcher.on('change', (file: string) => {
        if (file.includes('/client/')) {
          build({ configFile: CLIENT_CONFIG, logLevel: 'warn' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    clientBuildPlugin(),
    cloudflare({
      persistState: { path: '../.wrangler' },
    }),
  ],
});

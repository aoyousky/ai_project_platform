import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          // VITE_GLOB_API_URL=/api，转发到本地后端（与 plus-ui 的 /dev-api 行为一致）
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: 'http://localhost:8080',
            ws: true,
          },
        },
      },
    },
  };
});

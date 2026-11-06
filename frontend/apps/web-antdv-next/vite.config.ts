import { defineConfig } from '@vben/vite-config';

// 开发态 VITE_GLOB_API_URL=/api，生产态为 /prod-api（deploy/nginx 转发到后端 8080）。
// dev 与 preview 都要代理：E2E 跑生产构建产物（tests/e2e 的 baseURL 固定 5666），
// 生产构建请求走 /prod-api，因此两个前缀都要转发到本地后端。
const backend = 'http://localhost:8080';
const apiProxy = {
  '/api': {
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
    target: backend,
    ws: true,
  },
  '/prod-api': {
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/prod-api/, ''),
    target: backend,
    ws: true,
  },
};

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      preview: {
        proxy: apiProxy,
      },
      server: {
        proxy: apiProxy,
      },
    },
  };
});

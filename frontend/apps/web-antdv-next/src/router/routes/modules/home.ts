import type { RouteRecordRaw } from 'vue-router';

/**
 * RuoYi 的 `/index` 首页是前端常量路由（不在 `getRouters` 返回中，FR-015），
 * 因此 `accessMode` 必须是 `mixed`：后端菜单 + 前端常量路由。
 */
const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/index.vue'),
    meta: {
      affixTab: true,
      icon: 'lucide:home',
      order: -1,
      title: '首页',
    },
    name: 'Index',
    path: '/index',
  },
];

export default routes;

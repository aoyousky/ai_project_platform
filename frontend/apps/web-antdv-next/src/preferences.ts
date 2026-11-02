import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    /**
     * RuoYi 菜单来自后端，首页 `/index` 是前端常量路由（FR-015），
     * 因此必须是 mixed，不能只用 backend。
     */
    accessMode: 'mixed',
    defaultHomePath: '/index',
    /**
     * RuoYi 后端没有刷新令牌接口（ADR-002），令牌失效即回登录页。
     */
    enableRefreshToken: false,
    name: import.meta.env.VITE_APP_TITLE,
  },
});

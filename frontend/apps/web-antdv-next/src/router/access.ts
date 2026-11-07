import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'antdv-next';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView, ParentView } from '#/layouts';
import { $t } from '#/locales';
import { markUnportedMenus, normalizeViewComponent } from './coming-soon';

/** E-09 统一占位页；ComponentRecordType 要求惰性组件。 */
const ComingSoon = () => import('#/views/_core/fallback/coming-soon.vue');

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');
  // 已移植视图的归一化键集合：用于在路由生成前把未移植菜单替换为占位页（E-09）。
  const knownViews = new Set(Object.keys(pageMap).map(normalizeViewComponent));

  /**
   * 后端菜单里的 `component` 是 RuoYi 的组件名（Layout / ParentView / InnerLink）
   * 或视图相对路径。前两者与内链在这里落地为真实组件（data-model §3.1）。
   */
  const layoutMap: ComponentRecordType = {
    BasicLayout,
    ComingSoon,
    IFrameView,
    InnerLink: IFrameView,
    Layout: BasicLayout,
    ParentView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });
      // E-09：未移植菜单 → 统一占位页，避免落到 404 且不中断侧栏其余菜单。
      return markUnportedMenus(await getAllMenusApi(), knownViews);
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };

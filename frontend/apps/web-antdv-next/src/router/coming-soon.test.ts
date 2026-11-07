import { describe, expect, it } from 'vitest';

import {
  markUnportedMenus,
  normalizeViewComponent,
} from './coming-soon';

/**
 * SPEC-001 E-09：菜单指向尚未移植的组件时必须显示统一占位页，
 * 而不是 404；侧栏其余菜单保持可用（SC-002 菜单可达率 100%）。
 */
const KNOWN_VIEWS = new Set([
  '/_core/fallback/coming-soon.vue',
  '/system/user/index.vue',
  '/system/post/index.vue',
]);

describe('E-09 未移植菜单落到统一占位页', () => {
  it('已存在视图的组件保持原样', () => {
    const [route] = markUnportedMenus(
      [{ component: 'system/user/index', path: 'user' }],
      KNOWN_VIEWS,
    );
    expect(route?.component).toBe('system/user/index');
  });

  it('不存在的视图组件替换为 ComingSoon', () => {
    const [route] = markUnportedMenus(
      [{ component: 'monitor/cache/index', path: 'cache' }],
      KNOWN_VIEWS,
    );
    expect(route?.component).toBe('ComingSoon');
  });

  it('布局、父容器、内链与外链组件不参与替换', () => {
    for (const component of ['Layout', 'ParentView', 'InnerLink', 'IFrameView']) {
      const [route] = markUnportedMenus(
        [{ component, path: component }],
        KNOWN_VIEWS,
      );
      expect(route?.component, component).toBe(component);
    }
  });

  it('递归处理子路由，且不修改入参', () => {
    const original = [
      {
        children: [
          { component: 'monitor/cache/index', path: 'cache' },
          { component: 'system/post/index', path: 'post' },
        ],
        component: 'Layout',
        path: '/monitor',
      },
    ];
    const result = markUnportedMenus(original, KNOWN_VIEWS);
    expect(result[0]?.component).toBe('Layout');
    expect(result[0]?.children?.[0]?.component).toBe('ComingSoon');
    expect(result[0]?.children?.[1]?.component).toBe('system/post/index');
    // 入参未被修改
    expect(original[0]?.children?.[0]?.component).toBe('monitor/cache/index');
  });

  it('空组件保持空值（交给上游既有逻辑处理）', () => {
    const [route] = markUnportedMenus([{ component: '', path: 'x' }], KNOWN_VIEWS);
    expect(route?.component).toBe('');
  });

  it('视图路径归一化与后端组件名两侧一致', () => {
    expect(normalizeViewComponent('../views/system/user/index.vue')).toBe(
      '/system/user/index.vue',
    );
    expect(normalizeViewComponent('views/system/user/index')).toBe(
      '/system/user/index.vue',
    );
    expect(normalizeViewComponent('system/user/index')).toBe(
      '/system/user/index.vue',
    );
    expect(normalizeViewComponent('system/user/index.vue')).toBe(
      '/system/user/index.vue',
    );
    expect(normalizeViewComponent('/views/system/user/index.vue')).toBe(
      '/system/user/index.vue',
    );
  });
});

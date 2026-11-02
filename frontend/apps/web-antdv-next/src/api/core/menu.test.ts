import type { RouteRecordStringComponent } from '@vben/types';
import type { RouteRecordRaw } from 'vue-router';

import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

// 被测逻辑是纯转换函数；antdv-next 只是请求层的 UI 依赖，在单测中置空，
// 避免把整套组件库（及其 dayjs 插件）拉进 node 环境。
vi.mock('antdv-next', () => ({
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import getRoutersFixture from './__fixtures__/getRouters.json';
import type { RuoYiRouter } from './menu';
import { convertRuoYiMenus } from './menu';

/** 真实后端返回（2026-11-01 本地栈）：48 节点 / 39 叶子，含 1 个外链 */
const REAL_ROUTERS = (getRoutersFixture as unknown as { data: RuoYiRouter[] }).data;

const DummyComponent = { render: () => null };

/** 把字符串组件替换为占位组件，供 Vue Router 真正注册（证明可解析） */
function toRoutable(
  route: RouteRecordStringComponent,
): RouteRecordRaw {
  return {
    ...route,
    component: DummyComponent,
    children: route.children?.map(toRoutable),
  } as RouteRecordRaw;
}

function collect<T>(items: T[], next: (item: T) => T[] | undefined): T[] {
  return items.flatMap((item) => [item, ...collect(next(item) ?? [], next)]);
}

/**
 * 覆盖 SPEC §2 Golden Sample 2 与 E-04 ~ E-07：
 * RuoYi RouterVo → Vben RouteRecordStringComponent 的字段语义转换。
 */
describe('convertRuoYiMenus（RouterVo → Vben route）', () => {
  it('丢弃 redirect="noRedirect"（E-06）', () => {
    const [route] = convertRuoYiMenus([
      {
        component: 'system/post/index',
        meta: { noCache: false, title: '岗位管理' },
        name: 'Post',
        path: 'post',
        redirect: 'noRedirect',
      },
    ]);
    expect(route).not.toHaveProperty('redirect');
  });

  it('保留真实 redirect', () => {
    const [route] = convertRuoYiMenus([
      {
        component: 'Layout',
        meta: { title: '系统管理' },
        name: 'System',
        path: '/system',
        redirect: '/system/user',
      },
    ]);
    expect(route?.redirect).toBe('/system/user');
  });

  it('hidden:true → meta.hideInMenu（E-04）', () => {
    const [hidden] = convertRuoYiMenus([
      { component: 'system/menu/index', hidden: true, path: 'menu' },
    ]);
    const [visible] = convertRuoYiMenus([
      { component: 'system/post/index', path: 'post' },
    ]);
    expect(hidden?.meta?.hideInMenu).toBe(true);
    expect(visible?.meta?.hideInMenu).toBe(false);
  });

  it('meta.noCache → meta.keepAlive 取反（E-05、Golden Sample 2）', () => {
    const [noCache] = convertRuoYiMenus([
      { component: 'a/index', meta: { noCache: true }, path: 'a' },
    ]);
    const [cached] = convertRuoYiMenus([
      { component: 'b/index', meta: { noCache: false }, path: 'b' },
    ]);
    const [absent] = convertRuoYiMenus([{ component: 'c/index', path: 'c' }]);
    expect(noCache?.meta?.keepAlive).toBe(false);
    expect(cached?.meta?.keepAlive).toBe(true);
    expect(absent?.meta?.keepAlive).toBe(true);
  });

  it('icon:"#" 为占位，丢弃（E-07）', () => {
    const [placeholder] = convertRuoYiMenus([
      { component: 'a/index', meta: { icon: '#' }, path: 'a' },
    ]);
    const [real] = convertRuoYiMenus([
      { component: 'b/index', meta: { icon: 'system' }, path: 'b' },
    ]);
    expect(placeholder?.meta).not.toHaveProperty('icon');
    expect(real?.meta?.['icon']).toBe('system');
  });

  it('内链路径原样保留，不拼接父路径', () => {
    const routes = convertRuoYiMenus([
      {
        children: [
          { component: 'system/user/index', meta: { title: '用户管理' }, name: 'User', path: 'user' },
        ],
        component: 'Layout',
        meta: { title: '系统管理' },
        name: 'System',
        path: '/system',
      },
    ]);
    expect(routes[0]?.path).toBe('/system');
    expect(routes[0]?.children?.[0]?.path).toBe('user');
  });

  it('递归转换子菜单，保留 Layout/ParentView 组件名（由 layoutMap 二次映射）', () => {
    const [system] = convertRuoYiMenus([
      {
        children: [
          {
            component: 'ParentView',
            meta: { title: '权限' },
            path: 'auth',
            children: [{ component: 'system/role/index', path: 'role' }],
          },
        ],
        component: 'Layout',
        path: '/system',
      },
    ]);
    expect(system?.component).toBe('Layout');
    expect(system?.children?.[0]?.component).toBe('ParentView');
    expect(system?.children?.[0]?.children?.[0]?.component).toBe(
      'system/role/index',
    );
  });

  it('缺失 meta 时不抛错，title 为空串', () => {
    const [route] = convertRuoYiMenus([{ component: 'x/index', path: 'x' }]);
    expect(route?.meta?.title).toBe('');
  });
});

describe('Golden fixture：真实 getRouters（48 节点 / 39 叶子，A-03）', () => {
  const routes = convertRuoYiMenus(REAL_ROUTERS);
  const nodes = collect(routes, (route) => route.children);
  const leaves = nodes.filter((route) => !route.children?.length);

  it('节点数与叶子数与后端一致', () => {
    expect(nodes).toHaveLength(48);
    expect(leaves).toHaveLength(39);
  });

  it('无重名路由（A-03 / E-17）', () => {
    const names = nodes
      .map((route) => route.name)
      .filter((name): name is NonNullable<typeof name> => name != null);

    expect(new Set(names).size).toBe(names.length);
    // E-17：RuoYi 会生成含 `/`、`:` 的 name，必须原样保留且不冲突
    expect(names).toContain('User-auth/role/:userId131');
  });

  it('无 noRedirect 残留（A-03 / E-06）', () => {
    const leftovers = nodes.filter((route) => route.redirect === 'noRedirect');
    expect(leftovers).toHaveLength(0);
  });

  it('全部 48 个节点可被 Vue Router 注册且不抛错（A-03）', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [],
    });

    for (const route of routes) {
      router.addRoute(toRoutable(route));
    }

    expect(router.getRoutes()).toHaveLength(48);
  });

  it('外链节点不进路由表原路径，其他菜单不受影响（C2 / Golden Sample 反例）', () => {
    const external = nodes.find((route) =>
      String(route.path).startsWith('http'),
    );
    // 外链必须已被合成内部路径；整张表里不残留 http 开头的 path
    expect(external).toBeUndefined();
  });
});

describe('外链菜单（Golden Sample 反例 / C2）', () => {
  const URL = 'https://gitee.com/dromara/RuoYi-Vue-Plus';
  const [route] = convertRuoYiMenus([
    {
      component: 'Layout',
      meta: { link: URL, title: 'PLUS官网' },
      name: 'Plus',
      path: URL,
    },
  ]);

  it('合成稳定的内部路径 /iframe/<slug>-<hash>', () => {
    expect(route?.path).toBe('/iframe/gitee-com-dromara-ruoyi-vue-plus-hzp6uu');
  });

  it('映射为 IFrameView，真实 URL 只存 meta.iframeSrc', () => {
    expect(route?.component).toBe('IFrameView');
    expect(route?.meta?.['iframeSrc']).toBe(URL);
  });

  it('不得产生 meta.link（否则 Vben 会新窗口打开，内嵌失效）', () => {
    expect(route?.meta).not.toHaveProperty('link');
  });

  it('外链页面不参与 keep-alive', () => {
    expect(route?.meta?.['keepAlive']).toBe(false);
  });

  it('RuoYi 内链（component=InnerLink）同样内嵌且不写 meta.link', () => {
    const [inner] = convertRuoYiMenus([
      {
        component: 'InnerLink',
        meta: { link: 'https://example.com/doc', title: '帮助文档' },
        name: 'Help',
        path: '/help',
      },
    ]);

    expect(inner?.path).toBe('/help');
    expect(inner?.component).toBe('InnerLink');
    expect(inner?.meta?.['iframeSrc']).toBe('https://example.com/doc');
    expect(inner?.meta).not.toHaveProperty('link');
    expect(inner?.meta?.['keepAlive']).toBe(false);
  });
});

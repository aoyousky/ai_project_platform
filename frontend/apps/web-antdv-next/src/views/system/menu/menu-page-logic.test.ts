import type { MenuVO } from '#/api/system/menu/types';

import { describe, expect, it } from 'vitest';

import {
  buildMenuDeleteIds,
  buildMenuSubmitPayload,
  buildMenuTableData,
  canManageMenu,
  collectMenuSubtreeIds,
  getMenuTypeFieldFlags,
  hasMenuAdminRole,
  isValidActiveRoute,
  toMenuFormValues,
} from './menu-page-logic';

function menu(
  menuId: number | string,
  parentId: number | string,
  overrides: Partial<MenuVO> = {},
): MenuVO {
  return {
    menuId,
    menuName: `菜单-${menuId}`,
    menuType: 'C',
    orderNum: 1,
    parentId,
    status: '0',
    visible: '0',
    ...overrides,
  };
}

describe('menu-page-logic', () => {
  it('A-07 flat 列表构建为树，父节点缺失的节点提升为根', () => {
    const flat = [
      menu(1, 0),
      menu(2, '1'),
      menu(3, 2),
      menu(4, 0),
      menu(9, 99),
    ];

    const tree = buildMenuTableData(flat);

    expect(tree.map((node) => String(node.menuId))).toEqual(['1', '4', '9']);
    expect(String(tree[0]!.children[0]!.menuId)).toBe('2');
    expect(String(tree[0]!.children[0]!.children[0]!.menuId)).toBe('3');
  });

  it('A-08 级联删除收集节点及全部后代，父节点不在列表时返回空数组', () => {
    const flat = [menu(1, 0), menu(2, 1), menu(3, 2), menu(4, 1)];

    expect(collectMenuSubtreeIds(1, flat)).toEqual(['1', '2', '4', '3']);
    expect(collectMenuSubtreeIds(2, flat)).toEqual(['2', '3']);
    expect(collectMenuSubtreeIds(99, flat)).toEqual([]);
  });

  it('A-08 删除强依赖：单删只提交自身，级联删除提交全部后代 ID', () => {
    const flat = [menu(1, 0), menu(2, 1), menu(3, 2)];

    expect(buildMenuDeleteIds(menu(2, 1), flat, 'single')).toEqual(['2']);
    expect(buildMenuDeleteIds(menu(1, 0), flat, 'cascade')).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(buildMenuDeleteIds(menu(9, 0), flat, 'cascade')).toEqual(['9']);
  });

  it('A-14 按 menuType 切换字段可见性与必填', () => {
    expect(getMenuTypeFieldFlags('M', '0')).toEqual({
      pathRequired: true,
      showActiveRoute: false,
      showComponent: true,
      showPath: true,
      showPerms: false,
    });
    expect(getMenuTypeFieldFlags('C', '0')).toEqual({
      pathRequired: true,
      showActiveRoute: false,
      showComponent: true,
      showPath: true,
      showPerms: false,
    });
    expect(getMenuTypeFieldFlags('F', '1')).toEqual({
      pathRequired: false,
      showActiveRoute: false,
      showComponent: false,
      showPath: false,
      showPerms: true,
    });
    // 隐藏菜单才显示“激活路由”
    expect(getMenuTypeFieldFlags('M', '1').showActiveRoute).toBe(true);
  });

  it('A-09 仅 superadmin / 租户管理员具备菜单管理角色', () => {
    expect(hasMenuAdminRole(['superadmin'])).toBe(true);
    expect(hasMenuAdminRole(['admin'])).toBe(true);
    expect(hasMenuAdminRole(['spec003_menu_admin'])).toBe(false);
    expect(hasMenuAdminRole(undefined)).toBe(false);
  });

  it('A-09 菜单写操作要求管理员角色与权限码同时满足', () => {
    const admin = { hasAdminRole: true, permissions: ['system:menu:add'] };
    const codeOnly = { hasAdminRole: false, permissions: ['system:menu:add'] };
    const roleOnly = { hasAdminRole: true, permissions: [] };

    expect(canManageMenu(admin, 'add')).toBe(true);
    expect(canManageMenu(codeOnly, 'add')).toBe(false);
    expect(canManageMenu(roleOnly, 'add')).toBe(false);
    expect(
      canManageMenu(
        { hasAdminRole: true, permissions: ['*:*:*'] },
        'remove',
      ),
    ).toBe(true);
  });

  it('隐藏菜单的激活路由必须以 / 开头', () => {
    expect(isValidActiveRoute('/system/user')).toBe(true);
    expect(isValidActiveRoute('system/user')).toBe(false);
    expect(isValidActiveRoute('')).toBe(false);
  });

  it('A-14 隐藏菜单把激活路由写入 remark；按钮剔除路由字段', () => {
    const hiddenMenu = buildMenuSubmitPayload({
      activeRoute: '/system/user',
      component: 'system/user/index',
      menuName: '用户管理',
      menuType: 'C',
      orderNum: 1,
      parentId: '0',
      path: 'user',
      visible: '1',
    });
    expect(hiddenMenu.remark).toBe('/system/user');
    expect('activeRoute' in hiddenMenu).toBe(false);

    const button = buildMenuSubmitPayload({
      activeRoute: '',
      component: 'ignored',
      menuName: '新增用户',
      menuType: 'F',
      orderNum: 1,
      parentId: 5,
      path: 'ignored',
      perms: 'system:user:add',
      visible: '0',
    });
    expect(button).not.toHaveProperty('path');
    expect(button).not.toHaveProperty('component');
    expect(button).not.toHaveProperty('isFrame');
    expect(button).not.toHaveProperty('isCache');
    expect(button.perms).toBe('system:user:add');
  });

  it('编辑回显：隐藏菜单的 remark 拆到 activeRoute', () => {
    const values = toMenuFormValues(
      menu(7, 0, {
        menuName: '隐藏页',
        menuType: 'C',
        remark: '/system/hidden',
        visible: '1',
      }),
    );

    expect(values.activeRoute).toBe('/system/hidden');
    expect(values.remark).toBe('');
    expect(values.menuType).toBe('C');
    expect(String(values.menuId)).toBe('7');
  });
});

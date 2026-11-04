import type { MenuVO } from '#/api/system/menu/types';
import type { RoleVO } from '#/api/system/role/types';

import { describe, expect, it } from 'vitest';

import {
  buildRoleSubmitPayload,
  canModifyRole,
  collectDescendantMenuIds,
  isCustomDataScope,
  normalizeCheckedKeys,
  toRoleFormValues,
} from './role-page-logic';

function menu(menuId: number, parentId: number): MenuVO {
  return {
    menuId,
    menuName: `menu-${menuId}`,
    menuType: 'C',
    orderNum: 1,
    parentId,
    status: '0',
    visible: '0',
  };
}

describe('role-page-logic（SPEC-003 A-06 / A-08 / E-05）', () => {
  it('A-06 内置角色 1 不可修改，其余角色可修改', () => {
    expect(canModifyRole(1)).toBe(false);
    expect(canModifyRole('1')).toBe(false);
    expect(canModifyRole(2)).toBe(true);
    expect(canModifyRole('900000000000000006')).toBe(true);
    expect(canModifyRole(undefined)).toBe(true);
  });

  it('A-04 仅 dataScope=2 时显示自定义部门树', () => {
    expect(isCustomDataScope('2')).toBe(true);
    expect(isCustomDataScope('1')).toBe(false);
    expect(isCustomDataScope('3')).toBe(false);
    expect(isCustomDataScope(null)).toBe(false);
  });

  it('A-08 级联删除：收集节点及全部后代 ID，不修改入参', () => {
    const flat = [menu(1, 0), menu(2, 1), menu(3, 2), menu(4, 1), menu(5, 0)];
    const snapshot = structuredClone(flat);

    expect(collectDescendantMenuIds(1, flat)).toEqual(['1', '2', '4', '3']);
    expect(collectDescendantMenuIds(2, flat)).toEqual(['2', '3']);
    expect(collectDescendantMenuIds(99, flat)).toEqual([]);
    expect(flat).toEqual(snapshot);
  });

  it('勾选 keys 统一为字符串并剔除空值', () => {
    expect(normalizeCheckedKeys([1, '2', null, undefined, ''])).toEqual([
      '1',
      '2',
    ]);
    expect(normalizeCheckedKeys(undefined)).toEqual([]);
  });

  it('A-03 保存角色：menuIds 始终为数组，编辑补回 roleId', () => {
    const createPayload = buildRoleSubmitPayload({
      menuCheckStrictly: true,
      roleKey: 'spec003',
      roleName: '角色',
      roleSort: 1,
      status: '0',
    });

    expect(createPayload.menuIds).toEqual([]);
    expect(createPayload.roleId).toBeUndefined();

    const editPayload = buildRoleSubmitPayload(
      {
        menuIds: [1, '2'],
        roleKey: 'spec003',
        roleName: '角色改',
        roleSort: 2,
      },
      '900000000000000006',
    );

    expect(editPayload).toEqual({
      menuCheckStrictly: false,
      menuIds: ['1', '2'],
      roleId: '900000000000000006',
      roleKey: 'spec003',
      roleName: '角色改',
      roleSort: 2,
      status: '0',
    });
  });

  it('详情 + 勾选 → 表单初始值', () => {
    const role: RoleVO = {
      dataScope: '2',
      deptCheckStrictly: true,
      menuCheckStrictly: true,
      remark: null,
      roleId: '900000000000000006',
      roleKey: 'spec003',
      roleName: '角色',
      roleSort: 3,
      status: '0',
    };

    expect(toRoleFormValues(role, [1, '2'])).toEqual({
      menuCheckStrictly: true,
      menuIds: ['1', '2'],
      remark: '',
      roleId: '900000000000000006',
      roleKey: 'spec003',
      roleName: '角色',
      roleSort: 3,
      status: '0',
    });
  });
});

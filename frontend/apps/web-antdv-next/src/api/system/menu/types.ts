/**
 * 菜单域类型契约（SPEC-003 §4.3 / data-model §4）。
 * `/system/menu/list` 返回 flat list，树由前端构建。
 */
import type { Id } from '#/api/system/common';

export interface AuditFields {
  createBy?: Id | null;
  createTime?: null | string;
  updateBy?: Id | null;
  updateTime?: null | string;
  /** 查询扩展参数；`null` 等价空对象（SPEC-003 §4.1） */
  params?: null | Record<string, unknown>;
}

export interface MenuVO extends AuditFields {
  children?: MenuVO[];
  component?: null | string;
  createDept?: Id | null;
  icon?: null | string;
  /** '0' 外链 / '1' 否 */
  isCache?: null | string;
  /** '0' 是（外链） / '1' 否 */
  isFrame?: null | string;
  menuId: Id;
  menuName: string;
  /** 'M' 目录 / 'C' 菜单 / 'F' 按钮 */
  menuType: string;
  orderNum: number;
  parentId: Id;
  path?: null | string;
  perms?: null | string;
  queryParam?: null | string;
  /** 隐藏菜单场景兼作“激活路由” */
  remark?: null | string;
  /** '0' 正常 / '1' 停用 */
  status: string;
  /** '0' 显示 / '1' 隐藏 */
  visible: string;
}

export interface MenuForm {
  component?: null | string;
  icon?: null | string;
  isCache?: null | string;
  isFrame?: null | string;
  menuId?: Id;
  menuName: string;
  menuType: 'C' | 'F' | 'M';
  orderNum: number;
  parentId: Id;
  path?: null | string;
  perms?: null | string;
  queryParam?: null | string;
  remark?: null | string;
  status?: null | string;
  visible?: null | string;
}

export interface MenuQuery {
  menuId?: Id;
  menuName?: string;
  menuType?: string;
  parentId?: Id;
  status?: string;
  visible?: string;
}

/** Hutool 菜单树节点（`/system/menu/treeselect`） */
export interface MenuTreeOption {
  children?: MenuTreeOption[];
  icon?: null | string;
  id: Id;
  /** Hutool TreeNodeConfig.nameKey 被改为 label */
  label: string;
  menuType?: string;
  parentId: Id;
  status?: string;
  visible?: string;
  weight?: number;
}

export interface RoleMenuTree {
  checkedKeys: Id[];
  menus: MenuTreeOption[];
}

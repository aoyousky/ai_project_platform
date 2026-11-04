/**
 * 权限指令（SPEC-002 A-07）。
 *
 * 上游 `@vben/access` 的 `hasAccessByCodes` 是精确 Set 匹配，而 RuoYi 超级管理员
 * 的权限集合是通配符 `*:*:*`。这里替换为支持通配符的实现，其余语义与上游一致：
 * - `v-access:code` / 默认：按权限码判断；
 * - `v-access:role`（且 `accessMode === 'frontend'`）：按角色判断。
 */
import type { App, Directive, DirectiveBinding } from 'vue';

import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

/** RuoYi 超级管理员权限码 */
const SUPER_ADMIN_CODE = '*:*:*';

export function hasCodeAccess(
  ownedCodes: string[] | undefined,
  requiredCodes: string[],
): boolean {
  const owned = ownedCodes ?? [];
  if (owned.includes(SUPER_ADMIN_CODE)) {
    return true;
  }
  const ownedSet = new Set(owned);
  return requiredCodes.some((code) => ownedSet.has(code));
}

export function hasRoleAccess(
  ownedRoles: string[] | undefined,
  requiredRoles: string[],
): boolean {
  const owned = ownedRoles ?? [];
  const ownedSet = new Set(owned);
  return requiredRoles.some((role) => ownedSet.has(role));
}

function isAccessible(
  el: Element,
  binding: DirectiveBinding<string | string[]>,
): void {
  const value = binding.value;
  if (!value) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];
  const useRoles =
    preferences.app.accessMode === 'frontend' && binding.arg === 'role';

  const granted = useRoles
    ? hasRoleAccess(useUserStore().userRoles, values)
    : hasCodeAccess(useAccessStore().accessCodes, values);

  if (!granted) {
    el?.remove();
  }
}

const accessDirective: Directive = {
  mounted: isAccessible,
};

/**
 * 注册本应用的 `v-access` 指令。
 * 必须在 Pinia 初始化之后调用（指令挂载时会读取 store）。
 */
export function registerAccessDirective(app: App): void {
  app.directive('access', accessDirective);
}

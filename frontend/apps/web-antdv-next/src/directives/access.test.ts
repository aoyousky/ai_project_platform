import { describe, expect, it } from 'vitest';

import { hasCodeAccess } from './access';

describe('directives/access', () => {
  it('*:*:* 通配全部权限', () => {
    expect(hasCodeAccess(['*:*:*'], ['system:user:add'])).toBe(true);
  });

  it('精确匹配权限码', () => {
    expect(hasCodeAccess(['system:user:add'], ['system:user:add'])).toBe(true);
    expect(hasCodeAccess(['system:user:add'], ['system:user:remove'])).toBe(
      false,
    );
  });

  it('任一权限码匹配即通过', () => {
    expect(
      hasCodeAccess(['system:user:list'], [
        'system:user:add',
        'system:user:list',
      ]),
    ).toBe(true);
  });

  it('无权限码时拒绝', () => {
    expect(hasCodeAccess([], ['system:user:add'])).toBe(false);
  });
});

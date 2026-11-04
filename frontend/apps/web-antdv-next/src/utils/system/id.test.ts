import { describe, expect, it } from 'vitest';

import { normalizeIds, sameId, toIdKey } from './id';

describe('utils/system/id', () => {
  it('数字与字符串 ID 归一化为同一字符串', () => {
    expect(toIdKey(1)).toBe('1');
    expect(toIdKey('1')).toBe('1');
  });

  it('null / undefined 归一化为空串', () => {
    expect(toIdKey(null)).toBe('');
    expect(toIdKey(undefined)).toBe('');
  });

  it('sameId 跨类型比较', () => {
    expect(sameId(1, '1')).toBe(true);
    expect(sameId('1', 1)).toBe(true);
    expect(sameId(1, 2)).toBe(false);
  });

  it('normalizeIds 过滤空值并保持顺序', () => {
    expect(normalizeIds(['2', 1, null, undefined, ''])).toEqual(['2', '1']);
    expect(normalizeIds(null)).toEqual([]);
  });
});

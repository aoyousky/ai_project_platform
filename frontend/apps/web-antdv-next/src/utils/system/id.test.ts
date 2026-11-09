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

  it('超过 2^53-1 的字符串 ID 原样往返（E-30）', () => {
    // 2^53-1 = 9007199254740991；后一个值作为 number 会丢精度，必须保持字符串
    const large = '9007199254740993';
    expect(toIdKey(large)).toBe(large);
    expect(normalizeIds([large])).toEqual([large]);
    expect(sameId(large, large)).toBe(true);
    expect(sameId(large, '9007199254740992')).toBe(false);
  });
});

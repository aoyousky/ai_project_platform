import { describe, expect, it } from 'vitest';

import { resolveOutOfRangePage } from './pagination';

/**
 * SPEC-002 E-10 / SPEC-003 E-27：页码越界回退。
 * 只在“本页无数据且页码严格超过最大页”时回退，合法空页不得误判。
 */
describe('resolveOutOfRangePage', () => {
  it('本页无数据且超出最大页时回退到最大页', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 5, pageSize: 10, rowCount: 0, total: 12 }),
    ).toBe(2);
  });

  it('本页有数据时不回退', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 5, pageSize: 10, rowCount: 3, total: 12 }),
    ).toBeNull();
  });

  it('total=0 视为合法空列表，不回退', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 3, pageSize: 10, rowCount: 0, total: 0 }),
    ).toBeNull();
  });

  it('第一页无数据不回退', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 1, pageSize: 10, rowCount: 0, total: 100 }),
    ).toBeNull();
  });

  it('页码等于最大页的合法空页不回退', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 2, pageSize: 10, rowCount: 0, total: 20 }),
    ).toBeNull();
  });

  it('pageSize 非法（<=0）时不回退，避免除零', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 2, pageSize: 0, rowCount: 0, total: 20 }),
    ).toBeNull();
  });
});

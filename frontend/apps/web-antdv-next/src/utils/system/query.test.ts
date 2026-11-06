import { describe, expect, it } from 'vitest';

import { addDateRange, removeEmptyParams } from './query';

describe('utils/system/query', () => {
  it('日期范围写入 params.beginTime / params.endTime', () => {
    const query = { pageNum: 1 };
    expect(
      addDateRange(query, ['2026-11-01 00:00:00', '2026-11-03 23:59:59']),
    ).toEqual({
      pageNum: 1,
      params: {
        beginTime: '2026-11-01 00:00:00',
        endTime: '2026-11-03 23:59:59',
      },
    });
  });

  it('空日期不写入 params，并清理旧值', () => {
    const query = { params: { beginTime: 'old', endTime: 'old' } };
    expect(addDateRange(query, null)).toEqual({});
    expect(addDateRange(query, ['', ''])).toEqual({});
  });

  it('不修改入参', () => {
    const query = { params: { beginTime: 'old' }, pageNum: 2 };
    addDateRange(query, ['2026-11-01 00:00:00', '']);
    expect(query).toEqual({ params: { beginTime: 'old' }, pageNum: 2 });
  });

  it('removeEmptyParams 移除空串、null、undefined', () => {
    expect(
      removeEmptyParams({
        a: '',
        b: null,
        c: undefined,
        d: 0,
        e: 'x',
      }),
    ).toEqual({ d: 0, e: 'x' });
  });
});

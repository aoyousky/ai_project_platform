import { describe, expect, it } from 'vitest';

import {
  buildLogininforQuery,
  canUnlock,
  unlockUserName,
} from './logininfor-page-logic';

const PAGE = { currentPage: 2, pageSize: 20 };

const ROW_A = { infoId: '7', userName: 'spec004_lock' };
const ROW_B = { infoId: '8', userName: 'admin' };

describe('logininfor-page-logic', () => {
  it('解锁可用性：恰好勾选 1 条时可用（A-15）', () => {
    expect(canUnlock([])).toBe(false);
    expect(canUnlock([ROW_A])).toBe(true);
    expect(canUnlock([ROW_A, ROW_B])).toBe(false);
    // 无用户名的日志无法解锁，即便只勾选 1 条
    expect(canUnlock([{ userName: '' }])).toBe(false);
  });

  it('用户名提取：仅勾选 1 条时返回该行用户名，否则 undefined（E-16）', () => {
    expect(unlockUserName([ROW_A])).toBe('spec004_lock');
    expect(unlockUserName([])).toBeUndefined();
    expect(unlockUserName([ROW_A, ROW_B])).toBeUndefined();
    expect(unlockUserName([{ userName: null }])).toBeUndefined();
  });

  it('查询：日期范围进 params，空白条件移除，status 原样保留', () => {
    const query = buildLogininforQuery(
      {
        dateRange: ['2026-11-01', '2026-11-07'],
        ipaddr: '',
        status: '1',
        userName: 'spec004_lock',
      },
      PAGE,
    );

    expect(query).toEqual({
      status: '1',
      userName: 'spec004_lock',
      pageNum: 2,
      pageSize: 20,
      params: { beginTime: '2026-11-01', endTime: '2026-11-07' },
    });
    expect(query).not.toHaveProperty('ipaddr');
  });

  it('查询：无分页与日期时不发送对应字段', () => {
    const query = buildLogininforQuery({ userName: 'spec004_lock' });

    expect(query).toEqual({ userName: 'spec004_lock' });
  });

  it('排序映射：列字段 → orderByColumn，方向 → isAsc', () => {
    expect(
      buildLogininforQuery({ userName: 'spec004_lock' }, PAGE, {
        field: 'loginTime',
        order: 'desc',
      }),
    ).toEqual({
      userName: 'spec004_lock',
      pageNum: 2,
      pageSize: 20,
      orderByColumn: 'loginTime',
      isAsc: 'desc',
    });
  });

  it('排序缺省或信息不完整时不发送排序参数', () => {
    expect(buildLogininforQuery({}, PAGE)).not.toHaveProperty('orderByColumn');
    expect(
      buildLogininforQuery({}, undefined, { field: '', order: 'asc' }),
    ).not.toHaveProperty('orderByColumn');
  });
});

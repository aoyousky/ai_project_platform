import { describe, expect, it } from 'vitest';

import {
  buildOnlineQuery,
  deviceTypeText,
  displayValue,
  formatLoginTime,
  loadCachedRows,
  paginateRows,
  runBatchLogout,
  summarizeBatchResult,
} from './online-page-logic';

const DEVICE_DICT = [
  { label: 'PC', value: 'pc' },
  { label: '安卓', value: 'android' },
  { label: 'iOS', value: 'ios' },
  { label: '小程序', value: 'xcx' },
];

describe('online-page-logic', () => {
  it('空值显示「—」，真实 0 显示 0', () => {
    expect(displayValue(null)).toBe('—');
    expect(displayValue(undefined)).toBe('—');
    expect(displayValue('')).toBe('—');
    expect(displayValue(0)).toBe('0');
  });

  it('登录时间按 Asia/Shanghai 输出到秒', () => {
    const epoch = Date.UTC(2026, 10, 11, 1, 30, 0);

    expect(formatLoginTime(epoch)).toBe('2026-11-11 09:30:00');
  });

  it('设备类型命中字典显示标签，缺项回退原值，空值显示「—」', () => {
    expect(deviceTypeText('pc', DEVICE_DICT)).toBe('PC');
    expect(deviceTypeText('unknown', DEVICE_DICT)).toBe('unknown');
    expect(deviceTypeText(null, DEVICE_DICT)).toBe('—');
  });

  it('筛选：空串与未填写不下发，非空原样保留', () => {
    expect(buildOnlineQuery({})).toEqual({});
    expect(buildOnlineQuery({ ipaddr: '', userName: '' })).toEqual({});
    expect(
      buildOnlineQuery({ ipaddr: '10.0.0.1', userName: 'spec007_online' }),
    ).toEqual({ ipaddr: '10.0.0.1', userName: 'spec007_online' });
    expect(buildOnlineQuery({ userName: '  spaced  ' })).toEqual({
      userName: '  spaced  ',
    });
  });

  it('本地分页：每页 10 条，12 条第 2 页 2 条，越界页为空', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ id: index }));

    expect(paginateRows(rows, 1, 10)).toHaveLength(10);
    expect(paginateRows(rows, 2, 10)).toHaveLength(2);
    expect(paginateRows(rows, 3, 10)).toHaveLength(0);
    expect(paginateRows(rows, 0, 10)).toHaveLength(10);
  });

  it('本地分页：同一筛选条件翻页只取数一次（E-04）', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ id: index }));
    const cache = new Map<string, Array<{ id: number }>>();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return rows;
    };

    const first = await loadCachedRows(
      cache,
      'userName=spec007_online',
      fetcher,
    );
    const second = await loadCachedRows(
      cache,
      'userName=spec007_online',
      fetcher,
    );

    expect(calls).toBe(1);
    expect(paginateRows(first, 1, 10)).toHaveLength(10);
    expect(paginateRows(second, 2, 10)).toHaveLength(2);
  });

  it('批量汇总：全成功与部分失败文案', () => {
    expect(summarizeBatchResult(2, [])).toBe('成功 2 条，失败 0 条');
    expect(
      summarizeBatchResult(1, [{ tokenId: 'b', message: '服务器错误' }]),
    ).toBe('成功 1 条，失败 1 条：服务器错误');
  });

  it('批量强退：单条失败后继续执行其余条目并汇总', async () => {
    const called: string[] = [];
    const logout = async (tokenId: string) => {
      called.push(tokenId);
      if (tokenId === 'b') {
        throw new Error('服务器错误');
      }
    };

    const result = await runBatchLogout(['a', 'b', 'c'], logout);

    expect(called).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({
      successCount: 2,
      failures: [{ message: '服务器错误', tokenId: 'b' }],
    });
  });

  it('批量强退：非 Error 失败使用统一兜底文案', async () => {
    const result = await runBatchLogout(['a'], async () => {
      // 刻意抛出非 Error 值，验证统一兜底文案分支。
      // oxlint-disable-next-line no-throw-literal
      throw { message: 'network-error' };
    });

    expect(result.failures).toEqual([
      { message: '操作失败，请稍后重试', tokenId: 'a' },
    ]);
  });
});

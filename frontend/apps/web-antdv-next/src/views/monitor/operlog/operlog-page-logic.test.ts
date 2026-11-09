import { describe, expect, it } from 'vitest';

import {
  buildOperLogQuery,
  formatJsonOrRaw,
} from './operlog-page-logic';

const PAGE = { currentPage: 2, pageSize: 20 };

describe('operlog-page-logic', () => {
  it('合法 JSON 格式化为缩进文本，保留中文与嵌套结构', () => {
    const formatted = formatJsonOrRaw(
      '{"key":"value","nested":{"msg":"操作成功"}}',
    );

    expect(formatted).toContain('"key": "value"');
    expect(formatted).toContain('"msg": "操作成功"');
    expect(formatted.split('\n').length).toBeGreaterThan(1);
  });

  it('非法 JSON 与空值按原文返回（不做清洗）', () => {
    expect(formatJsonOrRaw('not-json')).toBe('not-json');
    expect(formatJsonOrRaw('')).toBe('');
    expect(formatJsonOrRaw(null)).toBe('');
    expect(formatJsonOrRaw(undefined)).toBe('');
  });

  it('查询：日期范围进 params，空 businessTypes 不下发', () => {
    const query = buildOperLogQuery(
      {
        businessTypes: [],
        dateRange: ['2026-11-01', '2026-11-07'],
        operName: 'spec004_operator',
        status: 0,
        title: 'Spec004 操作',
      },
      PAGE,
    );

    expect(query).toEqual({
      operName: 'spec004_operator',
      status: 0,
      title: 'Spec004 操作',
      pageNum: 2,
      pageSize: 20,
      params: { beginTime: '2026-11-01', endTime: '2026-11-07' },
    });
    expect(query).not.toHaveProperty('businessTypes');
  });

  it('查询：businessTypes 非空保留为数组，空白条件移除', () => {
    const query = buildOperLogQuery({
      businessTypes: [1, 2],
      operName: '',
      title: 'Spec004 操作',
    });

    expect(query.businessTypes).toEqual([1, 2]);
    expect(query).not.toHaveProperty('operName');
    expect(query).not.toHaveProperty('pageNum');
  });

  it('排序映射：列字段 → orderByColumn，方向 → isAsc', () => {
    expect(
      buildOperLogQuery({ title: 'Spec004 操作' }, PAGE, {
        field: 'operTime',
        order: 'desc',
      }),
    ).toEqual({
      title: 'Spec004 操作',
      pageNum: 2,
      pageSize: 20,
      orderByColumn: 'operTime',
      isAsc: 'desc',
    });
  });

  it('排序缺省或信息不完整时不发送排序参数', () => {
    const unsorted = buildOperLogQuery({ title: 'Spec004 操作' }, PAGE);
    expect(unsorted).not.toHaveProperty('orderByColumn');
    expect(unsorted).not.toHaveProperty('isAsc');

    expect(
      buildOperLogQuery({}, undefined, { field: '', order: 'asc' }),
    ).not.toHaveProperty('orderByColumn');
  });
});

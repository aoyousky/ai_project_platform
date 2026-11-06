import type { PostVO } from '#/api/system/post/types';

import { describe, expect, it } from 'vitest';

import {
  buildPostQuery,
  buildPostStatusPayload,
  buildPostSubmitPayload,
  toPostDeptOptions,
  toPostFormValues,
} from './post-page-logic';

function post(overrides: Partial<PostVO> = {}): PostVO {
  return {
    deptId: 100,
    postCode: 'spec003_post',
    postId: '900000000000000101',
    postName: '规格岗位',
    postSort: 1,
    status: '0',
    ...overrides,
  };
}

describe('post-page-logic', () => {
  it('A-12 提交体：编码/名称去空格，deptId 归一化为字符串，编辑补回 postId', () => {
    const create = buildPostSubmitPayload({
      deptId: 100,
      postCode: ' spec003_new ',
      postName: ' 新岗位 ',
      postSort: 2,
      status: '0',
    });
    expect(create).toEqual({
      deptId: '100',
      postCode: 'spec003_new',
      postName: '新岗位',
      postSort: 2,
      status: '0',
    });

    const edit = buildPostSubmitPayload(
      { deptId: '100', postCode: 'a', postName: 'b', postSort: 1 },
      '900000000000000101',
    );
    expect(edit.postId).toBe('900000000000000101');
  });

  it('A-19 启停：提交完整岗位对象，仅替换 status（无独立状态端点）', () => {
    const payload = buildPostStatusPayload(
      post({ remark: '备注', postCategory: 'tech' }),
      '1',
    );

    expect(payload).toEqual({
      deptId: '100',
      postCategory: 'tech',
      postCode: 'spec003_post',
      postId: '900000000000000101',
      postName: '规格岗位',
      postSort: 1,
      remark: '备注',
      status: '1',
    });
  });

  it('A-12 查询：分页、部门树筛选与日期范围同时生效', () => {
    const query = buildPostQuery(
      { dateRange: ['2026-01-01', '2026-01-31'], postName: '岗位' },
      { currentPage: 2, pageSize: 20 },
      100,
    );

    expect(query).toMatchObject({
      deptId: 100,
      pageNum: 2,
      pageSize: 20,
      params: { beginTime: '2026-01-01', endTime: '2026-01-31' },
      postName: '岗位',
    });
  });

  it('A-12 部门树转换为 TreeSelect 选项，ID 统一字符串', () => {
    const options = toPostDeptOptions([
      {
        id: 100,
        label: '总公司',
        parentId: 0,
        children: [{ id: '101', label: '研发部', parentId: '100' }],
      },
    ]);

    expect(options).toEqual([
      {
        children: [{ label: '研发部', value: '101' }],
        label: '总公司',
        value: '100',
      },
    ]);
  });

  it('编辑回显：ID 统一字符串，空值回落为空串', () => {
    const values = toPostFormValues(post({ remark: null, deptId: 100 }));

    expect(String(values.postId)).toBe('900000000000000101');
    expect(values.deptId).toBe('100');
    expect(values.remark).toBe('');
    expect(values.status).toBe('0');
  });
});

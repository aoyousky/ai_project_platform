import type { DeptVO } from '#/api/system/dept/types';

import { describe, expect, it } from 'vitest';

import {
  buildDeptFormValues,
  buildDeptParentOptions,
  buildDeptSubmitPayload,
  buildDeptTableData,
  filterDeptFlat,
} from './dept-page-logic';

function dept(
  deptId: number | string,
  parentId: number | string,
  overrides: Partial<DeptVO> = {},
): DeptVO {
  return {
    deptId,
    deptName: `部门-${deptId}`,
    orderNum: 1,
    parentId,
    status: '0',
    ...overrides,
  };
}

describe('dept-page-logic', () => {
  it('A-10 flat 列表构建为树，父节点缺失时提升为根', () => {
    const flat = [dept(100, 0), dept(101, 100), dept(102, '101'), dept(200, 0)];

    const tree = buildDeptTableData(flat);

    expect(tree.map((node) => String(node.deptId))).toEqual(['100', '200']);
    expect(String(tree[0]!.children[0]!.deptId)).toBe('101');
    expect(String(tree[0]!.children[0]!.children[0]!.deptId)).toBe('102');
  });

  it('A-15 名称筛选保留匹配节点的必要父级链', () => {
    const flat = [dept(100, 0), dept(101, 100), dept(102, 101), dept(200, 0)];

    const filtered = filterDeptFlat(flat, '部门-102');
    expect(filtered.map((node) => String(node.deptId))).toEqual([
      '100',
      '101',
      '102',
    ]);

    const tree = buildDeptTableData(filtered);
    expect(tree).toHaveLength(1);
    expect(String(tree[0]!.deptId)).toBe('100');

    expect(filterDeptFlat(flat, '')).toHaveLength(4);
    expect(filterDeptFlat(flat, '不存在')).toHaveLength(0);
  });

  it('A-10 编辑上级候选项排除自身及全部下级', () => {
    const options = buildDeptParentOptions([
      dept(100, 0),
      dept(101, 100),
      dept(102, 101),
      dept(200, 0),
    ]);

    expect(options.map((option) => option.value)).toEqual(['100', '200']);
    expect(options[0]!.children?.map((option) => option.value)).toEqual([
      '101',
    ]);

    // 后端 exclude 接口已完成排除；这里只做结构转换，不重复排除
    const excluded = buildDeptParentOptions([dept(200, 0)]);
    expect(excluded.map((option) => option.value)).toEqual(['200']);
  });

  it('A-11 提交体：ID 归一化为字符串，编辑补回 deptId', () => {
    const create = buildDeptSubmitPayload({
      deptName: ' 新部门 ',
      email: '',
      orderNum: 1,
      parentId: 100,
      phone: '',
      status: '0',
    });
    expect(create).toEqual({
      deptName: '新部门',
      email: '',
      orderNum: 1,
      parentId: '100',
      phone: '',
      status: '0',
    });

    const edit = buildDeptSubmitPayload(
      { deptName: '改', orderNum: 2, parentId: '0', status: '0' },
      '102',
    );
    expect(edit.deptId).toBe('102');

    expect(buildDeptSubmitPayload({ deptName: '根', orderNum: 1 }).parentId).toBe(
      '0',
    );
  });

  it('E-20 编辑回显不会把自身当作上级候选', () => {
    const values = buildDeptFormValues(dept(101, 100, { leader: 5 }));
    expect(String(values.parentId)).toBe('100');
    expect(String(values.deptId)).toBe('101');
    expect(values.leader).toBe('5');
  });
});

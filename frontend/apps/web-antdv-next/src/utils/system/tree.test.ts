import { describe, expect, it } from 'vitest';

import { buildTree, filterDisabledTree } from './tree';

interface Node {
  disabled?: boolean;
  id: number | string;
  label: string;
  parentId: number | string;
}

describe('utils/system/tree', () => {
  it('flat list 构建为树，保持输入顺序', () => {
    const input: Node[] = [
      { id: 1, label: '根', parentId: 0 },
      { id: 2, label: '子 A', parentId: 1 },
      { id: 3, label: '子 B', parentId: 1 },
    ];

    const tree = buildTree(input);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe('根');
    expect(tree[0]?.children.map((item) => item.label)).toEqual(['子 A', '子 B']);
  });

  it('父节点缺失的节点提升为根', () => {
    const input: Node[] = [
      { id: 2, label: '孤儿', parentId: 99 },
      { id: 3, label: '正常', parentId: 0 },
    ];

    const tree = buildTree(input);

    expect(tree.map((item) => item.label)).toEqual(['孤儿', '正常']);
  });

  it('数字与字符串 ID 视为同一父节点', () => {
    const input: Node[] = [
      { id: 1, label: '根', parentId: 0 },
      { id: '2', label: '子', parentId: '1' },
    ];

    expect(buildTree(input)[0]?.children).toHaveLength(1);
  });

  it('filterDisabledTree 递归过滤 disabled 节点', () => {
    const tree = buildTree([
      { id: 1, label: '根', parentId: 0 },
      { disabled: true, id: 2, label: '停用', parentId: 1 },
      { id: 3, label: '启用', parentId: 1 },
      { disabled: true, id: 4, label: '停用子', parentId: 3 },
    ]);

    const filtered = filterDisabledTree(tree);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.children.map((item) => item.label)).toEqual(['启用']);
    expect(filtered[0]?.children[0]?.children).toEqual([]);
  });

  it('不修改入参', () => {
    const input: Node[] = [{ id: 1, label: '根', parentId: 0 }];
    buildTree(input);
    expect(input).toEqual([{ id: 1, label: '根', parentId: 0 }]);
  });
});

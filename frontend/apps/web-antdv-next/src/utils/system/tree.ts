import { toIdKey } from './id';

type NodeRecord = Record<string, any>;

export type TreeNode<T extends NodeRecord> = T & {
  children: Array<TreeNode<T>>;
};

/**
 * flat list → 树。
 *
 * - 父节点不在当前结果集中的节点提升为根（与 plus-ui 菜单筛选行为一致）。
 * - 数字与字符串 ID 视为同一节点。
 * - 返回新对象，不修改入参。
 */
export function buildTree<T extends NodeRecord>(
  nodes: T[],
  idKey = 'id',
  parentKey = 'parentId',
): Array<TreeNode<T>> {
  const map = new Map<string, TreeNode<T>>();
  for (const node of nodes) {
    const key = toIdKey(node[idKey]);
    if (!key || map.has(key)) {
      continue;
    }
    map.set(key, { ...node, children: [] });
  }

  const roots: Array<TreeNode<T>> = [];
  for (const node of map.values()) {
    const parent = map.get(toIdKey(node[parentKey]));
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * 递归移除 `disabled === true` 的节点及其子树。
 */
export function filterDisabledTree<T extends NodeRecord>(
  nodes: Array<TreeNode<T>>,
): Array<TreeNode<T>> {
  return nodes
    .filter((node) => node.disabled !== true)
    .map((node) => ({
      ...node,
      children: filterDisabledTree(node.children ?? []),
    }));
}

export interface TreeSelectOption {
  children?: TreeSelectOption[];
  label: string;
  value: string;
}

/**
 * 树节点 → TreeSelect/ElTree 选项。
 * ID 统一转字符串（雪花 ID 精度问题）；无子节点时省略 `children`。
 */
export function toTreeSelectOptions<T extends NodeRecord>(
  nodes: Array<TreeNode<T>>,
  options: { labelKey?: string; valueKey?: string } = {},
): TreeSelectOption[] {
  const { labelKey = 'label', valueKey = 'id' } = options;

  return nodes.map((node) => {
    const children = node.children ?? [];
    return {
      label: String(node[labelKey] ?? ''),
      value: toIdKey(node[valueKey]),
      ...(children.length > 0
        ? { children: toTreeSelectOptions(children, options) }
        : {}),
    };
  });
}

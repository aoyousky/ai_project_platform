import type { DeptForm, DeptVO } from '#/api/system/dept/types';
import type { TreeSelectOption } from '#/utils/system/tree';

import { toIdKey } from '#/utils/system/id';
import { buildTree, toTreeSelectOptions } from '#/utils/system/tree';

/** flat 列表 → 部门树；父节点缺失时提升为根（A-10） */
export function buildDeptTableData(flat: DeptVO[]) {
  return buildTree(flat, 'deptId', 'parentId');
}

/**
 * 按名称筛选，并保留命中节点的全部祖先（A-15）。
 * 树表需要祖先链才不会把匹配节点错误提升为根。
 */
export function filterDeptFlat(flat: DeptVO[], keyword: string): DeptVO[] {
  const kw = keyword.trim();
  if (!kw) {
    return flat;
  }

  const byId = new Map(flat.map((node) => [toIdKey(node.deptId), node]));
  const keep = new Set<string>();

  for (const node of flat) {
    if (!node.deptName.includes(kw)) {
      continue;
    }
    let current: DeptVO | undefined = node;
    const guard = new Set<string>();
    while (current) {
      const key = toIdKey(current.deptId);
      if (guard.has(key)) {
        break;
      }
      guard.add(key);
      keep.add(key);
      current = byId.get(toIdKey(current.parentId));
    }
  }

  return flat.filter((node) => keep.has(toIdKey(node.deptId)));
}

/** 编辑时的上级部门候选（后端 `exclude/{deptId}` 已排除自身与全部下级） */
export function buildDeptParentOptions(flat: DeptVO[]): TreeSelectOption[] {
  return toTreeSelectOptions(buildDeptTableData(flat), {
    labelKey: 'deptName',
    valueKey: 'deptId',
  });
}

/** 表单值 → 提交体；ID 统一为字符串，父级缺省为顶级 `0` */
export function buildDeptSubmitPayload(
  values: Record<string, any>,
  deptId?: number | string,
): DeptForm {
  const effectiveDeptId = deptId ?? values.deptId;
  const payload: DeptForm = {
    deptName: String(values.deptName ?? '').trim(),
    email: values.email ? String(values.email) : '',
    orderNum: values.orderNum,
    parentId: values.parentId === undefined ? '0' : String(values.parentId),
    phone: values.phone ? String(values.phone) : '',
    status: values.status ?? '0',
  };

  if (values.deptCategory) {
    payload.deptCategory = String(values.deptCategory);
  }
  if (values.leader !== undefined && values.leader !== null && values.leader !== '') {
    payload.leader = values.leader;
  }
  if (effectiveDeptId !== undefined && effectiveDeptId !== null) {
    payload.deptId = effectiveDeptId;
  }

  return payload;
}

/** 部门详情 → 表单回显 */
export function buildDeptFormValues(dept: DeptVO): Record<string, any> {
  return {
    deptCategory: dept.deptCategory ?? '',
    deptId: dept.deptId,
    deptName: dept.deptName,
    email: dept.email ?? '',
    leader: dept.leader === null || dept.leader === undefined ? '' : String(dept.leader),
    orderNum: dept.orderNum,
    parentId: String(dept.parentId),
    phone: dept.phone ?? '',
    status: dept.status,
  };
}

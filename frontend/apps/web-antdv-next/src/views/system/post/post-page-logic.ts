import type { DeptTreeOption } from '#/api/system/dept/types';
import type { PostForm, PostQuery, PostVO } from '#/api/system/post/types';
import type { TreeSelectOption } from '#/utils/system/tree';

import { addDateRange, removeEmptyParams } from '#/utils/system/query';

/** 部门树 → TreeSelect 选项（ID 统一字符串） */
export function toPostDeptOptions(
  nodes: DeptTreeOption[],
): TreeSelectOption[] {
  return nodes.map((node) => ({
    label: node.label,
    value: String(node.id),
    ...(node.children && node.children.length > 0
      ? { children: toPostDeptOptions(node.children) }
      : {}),
  }));
}

/** 表单值 → 提交体；岗位编码/名称去空格，deptId 统一为字符串 */
export function buildPostSubmitPayload(
  values: Record<string, any>,
  postId?: number | string,
): PostForm {
  const effectivePostId = postId ?? values.postId;
  const payload: PostForm = {
    deptId: String(values.deptId ?? ''),
    postCode: String(values.postCode ?? '').trim(),
    postName: String(values.postName ?? '').trim(),
    postSort: values.postSort,
    status: values.status ?? '0',
  };

  if (values.postCategory) {
    payload.postCategory = String(values.postCategory);
  }
  if (values.remark !== undefined && values.remark !== null) {
    payload.remark = String(values.remark);
  }
  if (effectivePostId !== undefined && effectivePostId !== null) {
    payload.postId = effectivePostId;
  }

  return payload;
}

/**
 * 岗位没有独立的状态端点，启停必须提交完整对象（P-05）。
 * 被用户引用时后端拒绝停用（E-24）。
 */
export function buildPostStatusPayload(
  post: PostVO,
  status: string,
): PostForm {
  return {
    deptId: String(post.deptId),
    postCategory: post.postCategory ?? '',
    postCode: post.postCode,
    postId: post.postId,
    postName: post.postName,
    postSort: post.postSort,
    remark: post.remark ?? '',
    status,
  };
}

/** 查询条件：搜索表单 + 日期范围 + 左侧部门树 */
export function buildPostQuery(
  formValues: Record<string, any>,
  page: { currentPage: number; pageSize: number },
  deptId?: null | number | string,
): PostQuery {
  const { dateRange, ...rest } = formValues ?? {};
  return removeEmptyParams(
    addDateRange(
      {
        ...rest,
        ...(deptId === null || deptId === undefined ? {} : { deptId }),
        pageNum: page.currentPage,
        pageSize: page.pageSize,
      },
      dateRange as [string, string] | undefined,
    ),
  ) as PostQuery;
}

/** 岗位详情 → 表单回显 */
export function toPostFormValues(post: PostVO): Record<string, any> {
  return {
    deptId: String(post.deptId),
    postCategory: post.postCategory ?? '',
    postCode: post.postCode,
    postId: post.postId,
    postName: post.postName,
    postSort: post.postSort,
    remark: post.remark ?? '',
    status: post.status,
  };
}

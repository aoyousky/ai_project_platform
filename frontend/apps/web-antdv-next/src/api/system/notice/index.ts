import type { Notice, NoticeForm, NoticeQuery } from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 通知公告 API（SPEC-004 §2 / contracts/backend-api-consumed.md §5）。
 * 公告无导出端点；列表筛选不支持状态与时间范围。
 */
export async function listNoticeApi(
  query: NoticeQuery,
): Promise<PageResult<Notice>> {
  return requestClient.get<PageResult<Notice>>('/system/notice/list', {
    params: query,
  });
}

export async function getNoticeApi(noticeId: Id): Promise<Notice> {
  return requestClient.get<Notice>(`/system/notice/${noticeId}`);
}

export async function addNoticeApi(data: NoticeForm): Promise<void> {
  await requestClient.post('/system/notice', data);
}

export async function updateNoticeApi(data: NoticeForm): Promise<void> {
  await requestClient.put('/system/notice', data);
}

export async function delNoticeApi(noticeIds: Array<Id>): Promise<void> {
  await requestClient.delete(
    `/system/notice/${normalizeIds(noticeIds).join(',')}`,
  );
}

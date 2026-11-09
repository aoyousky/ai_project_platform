/**
 * 公告页可测逻辑（SPEC-004 A-04 / A-11 / E-11 / E-30）。
 *
 * 查询只提交标题/操作人员/类型（Packet §4.11 明确不支持状态与时间范围）；
 * 载荷补类型/状态缺省值；编辑回显时历史 Quill HTML 先经归一化。
 */
import type {
  Notice,
  NoticeForm,
  NoticeQuery,
} from '#/api/system/notice/types';

import { removeEmptyParams } from '#/utils/system/query';

import { normalizeLegacyNoticeHtml } from './legacy-notice-html';

interface PageParam {
  currentPage: number;
  pageSize: number;
}

interface DictItem {
  dictLabel?: null | string;
  dictValue?: null | string;
}

function toPageParams(page?: PageParam) {
  return page
    ? { pageNum: page.currentPage, pageSize: page.pageSize }
    : {};
}

/**
 * 查询：只保留 `noticeTitle` / `createByName` / `noticeType` 与分页参数。
 * 表单里即便带了 `status` 或 `dateRange` 也不下发（Packet §4.11、§7.4）。
 */
export function buildNoticeQuery(
  formValues: Record<string, any>,
  page?: PageParam,
): NoticeQuery {
  const { createByName, noticeTitle, noticeType } = formValues ?? {};
  return removeEmptyParams({
    createByName,
    noticeTitle,
    noticeType,
    ...toPageParams(page),
  }) as NoticeQuery;
}

/**
 * 表单值 → 提交体。标题去空格；类型/状态缺省为 `1`/`0`；正文原样保留。
 */
export function buildNoticeSubmitPayload(
  values: Record<string, any>,
  noticeId?: number | string,
): NoticeForm {
  const effectiveId = noticeId ?? values.noticeId;
  const payload: NoticeForm = {
    noticeContent:
      typeof values.noticeContent === 'string' ? values.noticeContent : '',
    noticeTitle: String(values.noticeTitle ?? '').trim(),
    noticeType: String(values.noticeType ?? '1').trim() || '1',
    status: String(values.status ?? '0').trim() || '0',
  };

  if (effectiveId !== undefined && effectiveId !== null) {
    payload.noticeId = effectiveId;
  }

  return payload;
}

/** 详情 → 表单回显；历史 `ql-*` 公告先归一化成 Tiptap 可识别标记 */
export function toNoticeFormValues(notice: Notice): Record<string, any> {
  return {
    noticeId: notice.noticeId,
    noticeContent: normalizeLegacyNoticeHtml(notice.noticeContent),
    noticeTitle: notice.noticeTitle,
    noticeType: notice.noticeType,
    status: notice.status,
  };
}

/** 字典标签：命中返回中文；未命中回退原值；空值返回空串 */
export function dictLabelOrValue(
  list: DictItem[] | undefined,
  value?: null | string,
): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (raw === '') {
    return '';
  }
  const hit = (list ?? []).find(
    (item) => String(item.dictValue ?? '') === raw,
  );
  const label = hit?.dictLabel ?? '';
  return label === '' ? raw : String(label);
}

const STATUS_COLOR: Record<string, string> = {
  '0': 'success',
  '1': 'error',
};

/** 公告状态标签颜色：0 正常 / 1 关闭；未知值用默认色 */
export function noticeStatusColor(value?: null | string): string {
  return STATUS_COLOR[String(value ?? '')] ?? 'default';
}

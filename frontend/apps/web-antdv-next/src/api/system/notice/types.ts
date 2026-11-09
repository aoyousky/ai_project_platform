import type { Id, PageQuery } from '#/api/system/common';

/** 通知公告（SPEC-004 §4.6） */
export interface Notice {
  createBy?: Id | null;
  createByName?: null | string;
  createTime?: null | string;
  noticeContent?: null | string;
  noticeId: Id;
  noticeTitle: string;
  noticeType: string;
  remark?: null | string;
  status: string;
}

/** 公告筛选：不支持状态与时间范围（Packet §4.11、§7.4） */
export interface NoticeQuery extends PageQuery {
  createByName?: string;
  noticeTitle?: string;
  noticeType?: string;
}

export interface NoticeForm {
  noticeContent?: null | string;
  noticeId?: Id;
  noticeTitle: string;
  noticeType: string;
  status: string;
}

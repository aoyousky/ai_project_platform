import type { Notice } from '#/api/system/notice/types';

import { describe, expect, it } from 'vitest';

import {
  buildNoticeQuery,
  buildNoticeSubmitPayload,
  dictLabelOrValue,
  noticeStatusColor,
  toNoticeFormValues,
} from './notice-page-logic';

const PAGE = { currentPage: 2, pageSize: 20 };

const notice: Notice = {
  createByName: 'admin',
  noticeContent:
    '<p class="ql-align-center">Spec004 居中正文</p><p>Spec004 普通正文</p>',
  noticeId: '900004000000000005',
  noticeTitle: 'Spec004 公告',
  noticeType: '1',
  status: '0',
  createTime: '2026-11-07 10:00:00',
  remark: null,
};

describe('notice-page-logic', () => {
  it('查询：仅发送标题/操作人员/类型，过滤状态与时间范围', () => {
    const query = buildNoticeQuery(
      {
        createByName: 'admin',
        dateRange: ['2026-11-01', '2026-11-07'],
        noticeTitle: '公告',
        noticeType: '1',
        status: '0',
      },
      PAGE,
    );

    expect(query).toEqual({
      createByName: 'admin',
      noticeTitle: '公告',
      noticeType: '1',
      pageNum: 2,
      pageSize: 20,
    });
  });

  it('查询：空白条件被移除，无分页参数时用于导出占位', () => {
    expect(buildNoticeQuery({ createByName: '', noticeTitle: '' })).toEqual({});
  });

  it('载荷：标题去空格，类型/状态缺省为 1/0，编辑补 noticeId', () => {
    const payload = buildNoticeSubmitPayload(
      {
        noticeContent: '<p>正文</p>',
        noticeId: 'ignored',
        noticeTitle: '  新公告  ',
      },
      '900004000000000005',
    );

    expect(payload).toEqual({
      noticeContent: '<p>正文</p>',
      noticeId: '900004000000000005',
      noticeTitle: '新公告',
      noticeType: '1',
      status: '0',
    });
  });

  it('载荷：新增时不带 noticeId，保留显式类型与状态', () => {
    const payload = buildNoticeSubmitPayload({
      noticeContent: '<p>正文</p>',
      noticeTitle: '新公告',
      noticeType: '2',
      status: '1',
    });

    expect(payload.noticeType).toBe('2');
    expect(payload.status).toBe('1');
    expect(payload).not.toHaveProperty('noticeId');
  });

  it('回显：历史 ql-* 归一化，null 内容转空串', () => {
    const values = toNoticeFormValues(notice);
    expect(values.noticeContent).toContain('text-align: center');
    expect(values.noticeTitle).toBe('Spec004 公告');
    expect(values.noticeType).toBe('1');
    expect(values.status).toBe('0');
    expect(toNoticeFormValues({ ...notice, noticeContent: null }).noticeContent)
      .toBe('');
  });

  it('字典标签：命中返回中文，未命中回退原值，空值返回空串', () => {
    const list = [
      { dictLabel: '通知', dictValue: '1' },
      { dictLabel: '公告', dictValue: '2' },
    ];

    expect(dictLabelOrValue(list, '1')).toBe('通知');
    expect(dictLabelOrValue(list, '2')).toBe('公告');
    expect(dictLabelOrValue(list, '9')).toBe('9');
    expect(dictLabelOrValue(list, '')).toBe('');
    expect(dictLabelOrValue(undefined, '1')).toBe('1');
  });

  it('状态颜色：0 正常为成功色，1 关闭为错误色', () => {
    expect(noticeStatusColor('0')).toBe('success');
    expect(noticeStatusColor('1')).toBe('error');
  });
});

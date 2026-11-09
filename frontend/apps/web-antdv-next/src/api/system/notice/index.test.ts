import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: mocks.del,
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
  },
}));

import {
  addNoticeApi,
  delNoticeApi,
  getNoticeApi,
  listNoticeApi,
  updateNoticeApi,
} from './index';

/**
 * 公告 API 契约（SPEC-004 §2 / contracts/backend-api-consumed.md §5）。
 * 无导出端点；列表不发送 status 与时间范围（由页面逻辑保证）。
 */
describe('api/system/notice 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
  });

  it('列表：GET /system/notice/list，条件走 query', async () => {
    const query = {
      createByName: 'admin',
      noticeTitle: 'Spec004 公告',
      noticeType: '1',
      pageNum: 1,
      pageSize: 10,
    };
    mocks.get.mockResolvedValue({
      rows: [{ noticeId: '900004000000000005', noticeTitle: 'Spec004 公告' }],
      total: 1,
    });

    const result = await listNoticeApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/system/notice/list', {
      params: query,
    });
    expect(result).toEqual({
      rows: [{ noticeId: '900004000000000005', noticeTitle: 'Spec004 公告' }],
      total: 1,
    });
  });

  it('详情：GET /system/notice/{noticeId}', async () => {
    await getNoticeApi('900004000000000005');

    expect(mocks.get).toHaveBeenCalledWith(
      '/system/notice/900004000000000005',
    );
  });

  it('新增：POST /system/notice', async () => {
    const form = {
      noticeContent: '<p>正文</p>',
      noticeTitle: '新公告',
      noticeType: '1',
      status: '0',
    };

    await addNoticeApi(form);

    expect(mocks.post).toHaveBeenCalledWith('/system/notice', form);
  });

  it('修改：PUT /system/notice（含 noticeId）', async () => {
    const form = {
      noticeId: '900004000000000005',
      noticeContent: '<p>正文</p>',
      noticeTitle: '新公告',
      noticeType: '1',
      status: '1',
    };

    await updateNoticeApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/system/notice', form);
  });

  it('删除：逗号分隔 noticeIds', async () => {
    await delNoticeApi(['7', 8]);

    expect(mocks.del).toHaveBeenCalledWith('/system/notice/7,8');
  });
});

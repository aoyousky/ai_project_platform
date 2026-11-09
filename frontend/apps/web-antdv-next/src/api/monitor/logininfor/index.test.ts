import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  downloadBlob: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: mocks.del,
    get: mocks.get,
    post: mocks.post,
  },
}));

vi.mock('#/api/system/common', () => ({
  downloadBlob: mocks.downloadBlob,
}));

import {
  cleanLogininforApi,
  delLogininforApi,
  exportLogininforApi,
  listLogininforApi,
  unlockLogininforApi,
} from './index';

/**
 * 登录日志 API 契约（SPEC-004 §2 / contracts/backend-api-consumed.md §6）。
 * 5 个端点：列表、导出、删除、清空、解锁。
 */
describe('api/monitor/logininfor 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
  });

  it('列表：GET /monitor/logininfor/list，筛选条件放 params', async () => {
    const query = {
      ipaddr: '127.0.0.1',
      pageNum: 1,
      pageSize: 10,
      status: '1',
      userName: 'spec004_lock',
    };
    mocks.get.mockResolvedValue({
      rows: [{ infoId: '900004000000000007', userName: 'spec004_lock' }],
      total: 1,
    });

    const result = await listLogininforApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/monitor/logininfor/list', {
      params: query,
    });
    expect(result).toEqual({
      rows: [{ infoId: '900004000000000007', userName: 'spec004_lock' }],
      total: 1,
    });
  });

  it('导出：POST /monitor/logininfor/export，参数放 query', async () => {
    const query = { status: '1', userName: 'spec004_lock' };

    await exportLogininforApi(query);

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/monitor/logininfor/export',
      expect.objectContaining({
        fileName: '登录日志.xlsx',
        params: query,
      }),
    );
  });

  it('删除：逗号分隔 infoIds', async () => {
    await delLogininforApi(['7', 8]);

    expect(mocks.del).toHaveBeenCalledWith('/monitor/logininfor/7,8');
  });

  it('清空：DELETE /monitor/logininfor/clean', async () => {
    await cleanLogininforApi();

    expect(mocks.del).toHaveBeenCalledWith('/monitor/logininfor/clean');
  });

  it('解锁：GET /monitor/logininfor/unlock/{userName}', async () => {
    await unlockLogininforApi('spec004_lock');

    expect(mocks.get).toHaveBeenCalledWith(
      '/monitor/logininfor/unlock/spec004_lock',
    );
  });
});

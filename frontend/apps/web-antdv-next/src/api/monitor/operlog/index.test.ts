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
  cleanOperLogApi,
  delOperLogApi,
  exportOperLogApi,
  listOperLogApi,
} from './index';

/**
 * 操作日志 API 契约（SPEC-004 §2 / contracts/backend-api-consumed.md §6）。
 * 4 个端点：列表、导出、删除、清空。
 */
describe('api/monitor/operlog 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
  });

  it('列表：GET /monitor/operlog/list，businessTypes 用 repeat 序列化', async () => {
    const query = {
      businessTypes: [1, 2],
      operName: 'spec004_operator',
      pageNum: 1,
      pageSize: 10,
      title: 'Spec004 操作',
    };
    mocks.get.mockResolvedValue({
      rows: [{ operId: '900004000000000006', title: 'Spec004 操作' }],
      total: 1,
    });

    const result = await listOperLogApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/monitor/operlog/list', {
      params: query,
      paramsSerializer: 'repeat',
    });
    expect(result).toEqual({
      rows: [{ operId: '900004000000000006', title: 'Spec004 操作' }],
      total: 1,
    });
  });

  it('导出：POST /monitor/operlog/export，参数放 query', async () => {
    const query = { operName: 'spec004_operator', title: 'Spec004 操作' };

    await exportOperLogApi(query);

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/monitor/operlog/export',
      expect.objectContaining({
        fileName: '操作日志.xlsx',
        params: query,
      }),
    );
  });

  it('删除：逗号分隔 operIds', async () => {
    await delOperLogApi(['7', 8]);

    expect(mocks.del).toHaveBeenCalledWith('/monitor/operlog/7,8');
  });

  it('清空：DELETE /monitor/operlog/clean', async () => {
    await cleanOperLogApi();

    expect(mocks.del).toHaveBeenCalledWith('/monitor/operlog/clean');
  });
});

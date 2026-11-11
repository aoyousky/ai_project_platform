import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forceLogoutOnlineApi, listOnlineApi } from './index';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: mocks.del,
    get: mocks.get,
  },
}));

/**
 * 在线用户 API 契约（SPEC-007 §4.1、§4.5 / contracts/backend-api-consumed.md §2）。
 * 只消费列表与单条强退两个既有端点。
 */
describe('api/monitor/online 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.del.mockResolvedValue(null);
  });

  it('列表：GET /monitor/online/list，参数原样传递且不分页', async () => {
    const query = { ipaddr: '10.0.0.1', userName: 'spec007_online' };
    mocks.get.mockResolvedValue({
      rows: [{ tokenId: 'token-a', userName: 'spec007_online' }],
      total: 1,
    });

    const result = await listOnlineApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/monitor/online/list', {
      params: query,
    });
    expect(result).toEqual({
      rows: [{ tokenId: 'token-a', userName: 'spec007_online' }],
      total: 1,
    });
  });

  it('单条强退：DELETE /monitor/online/{encodeURIComponent(tokenId)}', async () => {
    await forceLogoutOnlineApi('token/a+b');

    expect(mocks.del).toHaveBeenCalledWith('/monitor/online/token%2Fa%2Bb');
  });

  it('单条强退失败：原样 reject，不吞异常', async () => {
    mocks.del.mockRejectedValue(new Error('服务器错误'));

    await expect(forceLogoutOnlineApi('token-a')).rejects.toThrow('服务器错误');
  });
});

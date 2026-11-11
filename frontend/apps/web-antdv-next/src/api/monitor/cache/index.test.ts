import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCacheInfoApi } from './index';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: {
    get: mocks.get,
  },
}));

/**
 * 缓存监控 API 契约（SPEC-007 §4.2 / contracts/backend-api-consumed.md §3）。
 * 只消费 `GET /monitor/cache`，不带任何参数。
 */
describe('api/monitor/cache 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('成功：GET /monitor/cache，解包 data 原样返回', async () => {
    const data = {
      info: { redis_version: '7.2.5', redis_mode: 'standalone' },
      dbSize: 0,
      commandStats: [{ name: 'get', value: '120' }],
    };
    mocks.get.mockResolvedValue(data);

    const result = await getCacheInfoApi();

    expect(mocks.get).toHaveBeenCalledWith('/monitor/cache');
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(result).toEqual(data);
  });

  it('失败：原样 reject，不吞异常', async () => {
    mocks.get.mockRejectedValue(new Error('Redis 连接失败'));

    await expect(getCacheInfoApi()).rejects.toThrow('Redis 连接失败');
  });
});

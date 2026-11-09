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
  addOssConfigApi,
  changeOssConfigStatusApi,
  delOssConfigApi,
  getOssConfigApi,
  listOssConfigApi,
  updateOssConfigApi,
} from './config';

/**
 * 文件配置 API 契约（SPEC-004 §2 / contracts §4.9、data-model §10）。
 * 6 个端点：列表、详情、新增、修改、删除、切换默认。
 */
describe('api/system/oss/config 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
  });

  it('列表：GET /resource/oss/config/list，条件走 query', async () => {
    const query = {
      bucketName: 'spec004_bucket',
      configKey: 'spec004_oss_config',
      pageNum: 1,
      pageSize: 10,
      status: '1',
    };
    mocks.get.mockResolvedValue({
      rows: [
        {
          ossConfigId: '900004000000000010',
          configKey: 'spec004_oss_config',
          status: '1',
        },
      ],
      total: 1,
    });

    const result = await listOssConfigApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/resource/oss/config/list', {
      params: query,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.configKey).toBe('spec004_oss_config');
  });

  it('详情：GET /resource/oss/config/{ossConfigId}', async () => {
    await getOssConfigApi('900004000000000010');

    expect(mocks.get).toHaveBeenCalledWith(
      '/resource/oss/config/900004000000000010',
    );
  });

  it('新增：POST /resource/oss/config，请求体为表单模型', async () => {
    const form = {
      accessKey: 'spec004_access_key',
      accessPolicy: '0',
      bucketName: 'spec004_bucket_name',
      configKey: 'spec004_oss_config',
      endpoint: '127.0.0.1:9000',
      isHttps: 'N',
      secretKey: 'spec004_secret_key',
      status: '1',
    };

    await addOssConfigApi(form);

    expect(mocks.post).toHaveBeenCalledWith('/resource/oss/config', form);
  });

  it('修改：PUT /resource/oss/config（含 ossConfigId）', async () => {
    const form = {
      accessKey: 'spec004_access_key',
      accessPolicy: '0',
      bucketName: 'spec004_bucket_name_v2',
      configKey: 'spec004_oss_config',
      endpoint: '127.0.0.1:9000',
      isHttps: 'N',
      ossConfigId: '900004000000000010',
      secretKey: 'spec004_secret_key',
      status: '1',
    };

    await updateOssConfigApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/resource/oss/config', form);
  });

  it('删除：DELETE /resource/oss/config/{逗号分隔编号}，编号归一化为字符串', async () => {
    await delOssConfigApi([2, '900004000000000010']);

    expect(mocks.del).toHaveBeenCalledWith(
      '/resource/oss/config/2,900004000000000010',
    );
  });

  it('切换默认：PUT /resource/oss/config/changeStatus，载荷 status 固定为 0', async () => {
    const payload = {
      configKey: 'spec004_oss_config',
      ossConfigId: '900004000000000010',
      status: '0' as const,
    };

    await changeOssConfigStatusApi(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      '/resource/oss/config/changeStatus',
      payload,
    );
  });
});

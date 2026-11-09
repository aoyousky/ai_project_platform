import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  downloadBlob: vi.fn(),
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

vi.mock('#/api/system/common', () => ({
  downloadBlob: mocks.downloadBlob,
}));

import {
  addConfigApi,
  delConfigApi,
  exportConfigApi,
  getConfigApi,
  getConfigKeyApi,
  listConfigApi,
  refreshConfigCacheApi,
  updateConfigApi,
  updateConfigByKeyApi,
} from './index';

/**
 * 参数 API 契约（SPEC-004 §2 / contracts/backend-api-consumed.md §4）。
 * 9 个端点：列表、导出、详情、按键取值、新增、修改、按键更新、删除、刷新缓存。
 */
describe('api/system/config 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
  });

  it('列表：GET /system/config/list，条件走 query，返回 {rows,total}', async () => {
    const query = {
      configKey: 'spec004.config.key',
      configName: '参数',
      configType: 'N',
      pageNum: 1,
      pageSize: 10,
    };
    mocks.get.mockResolvedValue({
      rows: [
        {
          configId: '900004000000000004',
          configKey: 'spec004.config.key',
          configType: 'N',
        },
      ],
      total: 1,
    });

    const result = await listConfigApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/system/config/list', {
      params: query,
    });
    expect(result).toEqual({
      rows: [
        {
          configId: '900004000000000004',
          configKey: 'spec004.config.key',
          configType: 'N',
        },
      ],
      total: 1,
    });
  });

  it('详情：GET /system/config/{configId}', async () => {
    await getConfigApi('900004000000000004');

    expect(mocks.get).toHaveBeenCalledWith(
      '/system/config/900004000000000004',
    );
  });

  it('按键取值：GET /system/config/configKey/{configKey}，返回字符串', async () => {
    mocks.get.mockResolvedValue('spec004-value-a');

    await expect(getConfigKeyApi('spec004.config.key')).resolves.toBe(
      'spec004-value-a',
    );
    expect(mocks.get).toHaveBeenCalledWith(
      '/system/config/configKey/spec004.config.key',
    );
  });

  it('新增：POST /system/config', async () => {
    const form = {
      configKey: 'spec004.e2e.key',
      configName: 'E2E 参数',
      configType: 'N',
      configValue: 'value-a',
    };

    await addConfigApi(form);

    expect(mocks.post).toHaveBeenCalledWith('/system/config', form);
  });

  it('修改：PUT /system/config（含 configId）', async () => {
    const form = {
      configId: '900004000000000004',
      configKey: 'spec004.config.key',
      configName: '参数',
      configType: 'N',
      configValue: 'spec004-value-b',
    };

    await updateConfigApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/system/config', form);
  });

  it('按键更新：PUT /system/config/updateByKey', async () => {
    const payload = {
      configKey: 'sys.oss.previewListResource',
      configValue: 'false',
    };

    await updateConfigByKeyApi(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      '/system/config/updateByKey',
      payload,
    );
  });

  it('删除：逗号分隔 configIds', async () => {
    await delConfigApi(['7', 8]);

    expect(mocks.del).toHaveBeenCalledWith('/system/config/7,8');
  });

  it('刷新缓存：DELETE /system/config/refreshCache', async () => {
    await refreshConfigCacheApi();

    expect(mocks.del).toHaveBeenCalledWith('/system/config/refreshCache');
  });

  it('导出：POST /system/config/export，参数放 query', async () => {
    const query = { configKey: 'spec004.config.key' };

    await exportConfigApi(query);

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/system/config/export',
      expect.objectContaining({
        fileName: '参数设置.xlsx',
        params: query,
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  downloadBlob: vi.fn(),
  get: vi.fn(),
  getDictDataByTypeApi: vi.fn(),
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
  getDictDataByTypeApi: mocks.getDictDataByTypeApi,
}));

import {
  addDictDataApi,
  addDictTypeApi,
  deleteDictDataApi,
  deleteDictTypeApi,
  exportDictDataApi,
  exportDictTypeApi,
  getDictDataApi,
  getDictDataByTypeApi,
  getDictDataListApi,
  getDictTypeApi,
  getDictTypeListApi,
  optionselectDictTypeApi,
  refreshDictTypeCacheApi,
  updateDictDataApi,
  updateDictTypeApi,
} from './index';

/**
 * 字典 API 契约（SPEC-004 §2 / contracts/backend-api-consumed.md §2–§3）。
 * 8 个字典类型端点 + 6 个字典数据端点。
 */
describe('api/system/dict 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
    mocks.getDictDataByTypeApi.mockResolvedValue([]);
  });

  describe('字典类型', () => {
    it('列表：GET /system/dict/type/list，条件走 query，返回 {rows,total}', async () => {
      const query = {
        dictName: '字典',
        dictType: 'spec004_dict_type',
        pageNum: 1,
        pageSize: 10,
      };
      mocks.get.mockResolvedValue({
        rows: [{ dictId: '1', dictName: '字典', dictType: 'spec004_dict_type' }],
        total: 1,
      });

      const result = await getDictTypeListApi(query);

      expect(mocks.get).toHaveBeenCalledWith('/system/dict/type/list', {
        params: query,
      });
      expect(result).toEqual({
        rows: [{ dictId: '1', dictName: '字典', dictType: 'spec004_dict_type' }],
        total: 1,
      });
    });

    it('详情：GET /system/dict/type/{dictId}', async () => {
      await getDictTypeApi('900004000000000001');

      expect(mocks.get).toHaveBeenCalledWith(
        '/system/dict/type/900004000000000001',
      );
    });

    it('选项：GET /system/dict/type/optionselect', async () => {
      await optionselectDictTypeApi();

      expect(mocks.get).toHaveBeenCalledWith('/system/dict/type/optionselect');
    });

    it('新增/修改：POST/PUT /system/dict/type', async () => {
      const form = { dictName: '测试字典', dictType: 'spec004_test' };

      await addDictTypeApi(form);
      await updateDictTypeApi({ ...form, dictId: '7' });

      expect(mocks.post).toHaveBeenCalledWith('/system/dict/type', form);
      expect(mocks.put).toHaveBeenCalledWith('/system/dict/type', {
        ...form,
        dictId: '7',
      });
    });

    it('删除：逗号分隔 ID', async () => {
      await deleteDictTypeApi(['7', 8]);

      expect(mocks.del).toHaveBeenCalledWith('/system/dict/type/7,8');
    });

    it('刷新缓存：DELETE /system/dict/type/refreshCache', async () => {
      await refreshDictTypeCacheApi();

      expect(mocks.del).toHaveBeenCalledWith('/system/dict/type/refreshCache');
    });

    it('导出：POST /system/dict/type/export，参数放 query', async () => {
      const query = { dictType: 'spec004_dict_type' };

      await exportDictTypeApi(query);

      expect(mocks.downloadBlob).toHaveBeenCalledWith(
        '/system/dict/type/export',
        expect.objectContaining({
          fileName: '字典类型.xlsx',
          params: query,
        }),
      );
    });
  });

  describe('字典数据', () => {
    it('列表：GET /system/dict/data/list，条件走 query', async () => {
      const query = {
        dictLabel: '标签',
        dictType: 'spec004_dict_type',
        pageNum: 1,
        pageSize: 10,
      };

      await getDictDataListApi(query);

      expect(mocks.get).toHaveBeenCalledWith('/system/dict/data/list', {
        params: query,
      });
    });

    it('详情：GET /system/dict/data/{dictCode}', async () => {
      await getDictDataApi('900004000000000002');

      expect(mocks.get).toHaveBeenCalledWith(
        '/system/dict/data/900004000000000002',
      );
    });

    it('新增/修改：POST/PUT /system/dict/data', async () => {
      const form = {
        dictLabel: '标签',
        dictSort: 0,
        dictType: 'spec004_dict_type',
        dictValue: 'spec004_value',
      };

      await addDictDataApi(form);
      await updateDictDataApi({ ...form, dictCode: '9' });

      expect(mocks.post).toHaveBeenCalledWith('/system/dict/data', form);
      expect(mocks.put).toHaveBeenCalledWith('/system/dict/data', {
        ...form,
        dictCode: '9',
      });
    });

    it('删除：逗号分隔字典数据 ID', async () => {
      await deleteDictDataApi(['9', 10]);

      expect(mocks.del).toHaveBeenCalledWith('/system/dict/data/9,10');
    });

    it('导出：POST /system/dict/data/export，参数放 query', async () => {
      const query = { dictType: 'spec004_dict_type' };

      await exportDictDataApi(query);

      expect(mocks.downloadBlob).toHaveBeenCalledWith(
        '/system/dict/data/export',
        expect.objectContaining({
          fileName: '字典数据.xlsx',
          params: query,
        }),
      );
    });

    it('按类型读取：复用 common 的 getDictDataByTypeApi', async () => {
      mocks.getDictDataByTypeApi.mockResolvedValue([
        { dictLabel: '标签一', dictValue: 'spec004_value_a' },
      ]);

      await expect(
        getDictDataByTypeApi('spec004_dict_type'),
      ).resolves.toEqual([
        { dictLabel: '标签一', dictValue: 'spec004_value_a' },
      ]);
      expect(mocks.getDictDataByTypeApi).toHaveBeenCalledWith(
        'spec004_dict_type',
      );
    });
  });
});

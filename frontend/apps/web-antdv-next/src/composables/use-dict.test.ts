import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDictDataByTypeApi } = vi.hoisted(() => ({
  getDictDataByTypeApi: vi.fn(),
}));

vi.mock('#/api/system/common', () => ({
  getDictDataByTypeApi,
}));

import { clearDictCache, dictLabel, useDict } from './use-dict';

describe('composables/use-dict', () => {
  beforeEach(() => {
    clearDictCache();
    getDictDataByTypeApi.mockReset();
  });

  it('同一 dictType 只请求一次', async () => {
    getDictDataByTypeApi.mockResolvedValue([
      { dictLabel: '正常', dictValue: '0' },
      { dictLabel: '停用', dictValue: '1' },
    ]);

    const first = useDict('sys_normal_disable');
    const second = useDict('sys_normal_disable');

    await vi.waitFor(() => {
      expect(first.sys_normal_disable.value).toHaveLength(2);
      expect(second.sys_normal_disable.value).toHaveLength(2);
    });

    expect(getDictDataByTypeApi).toHaveBeenCalledTimes(1);
  });

  it('并发请求复用同一个 Promise', async () => {
    let resolvePromise: (value: any[]) => void = () => {};
    getDictDataByTypeApi.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const first = useDict('sys_user_sex');
    const second = useDict('sys_user_sex');
    resolvePromise([{ dictLabel: '男', dictValue: '0' }]);

    await vi.waitFor(() => {
      expect(first.sys_user_sex.value).toHaveLength(1);
      expect(second.sys_user_sex.value).toHaveLength(1);
    });

    expect(getDictDataByTypeApi).toHaveBeenCalledTimes(1);
  });

  it('请求失败不缓存，下一次会重新请求', async () => {
    getDictDataByTypeApi.mockRejectedValueOnce(new Error('network'));
    getDictDataByTypeApi.mockResolvedValueOnce([
      { dictLabel: '显示', dictValue: '0' },
    ]);

    const first = useDict('sys_show_hide');
    await vi.waitFor(() => {
      expect(getDictDataByTypeApi).toHaveBeenCalledTimes(1);
    });

    const second = useDict('sys_show_hide');
    await vi.waitFor(() => {
      expect(second.sys_show_hide.value).toHaveLength(1);
    });

    expect(first.sys_show_hide.value).toEqual([]);
    expect(getDictDataByTypeApi).toHaveBeenCalledTimes(2);
  });

  it('clearDictCache 后重新请求', async () => {
    getDictDataByTypeApi.mockResolvedValue([
      { dictLabel: '正常', dictValue: '0' },
    ]);

    useDict('sys_normal_disable');
    await vi.waitFor(() => expect(getDictDataByTypeApi).toHaveBeenCalledTimes(1));

    clearDictCache();
    useDict('sys_normal_disable');
    await vi.waitFor(() => expect(getDictDataByTypeApi).toHaveBeenCalledTimes(2));
  });

  it('dictLabel 找不到值时回退为空串', () => {
    const list = [{ dictLabel: '正常', dictValue: '0' }];
    expect(dictLabel(list, '0')).toBe('正常');
    expect(dictLabel(list, '1')).toBe('');
    expect(dictLabel(list, null)).toBe('');
  });
});

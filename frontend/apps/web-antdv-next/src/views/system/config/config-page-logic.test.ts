import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearDictCache } = vi.hoisted(() => ({
  clearDictCache: vi.fn(),
}));

vi.mock('#/composables/use-dict', () => ({
  clearDictCache,
}));

import type { Config } from '#/api/system/config/types';

import {
  buildConfigQuery,
  buildConfigSubmitPayload,
  configTypeInfo,
  refreshConfigCache,
  toConfigFormValues,
} from './config-page-logic';

const PAGE = { currentPage: 2, pageSize: 20 };

const config: Config = {
  configId: '900004000000000004',
  configKey: 'spec004.config.key',
  configName: 'Spec004 参数',
  configType: 'N',
  configValue: 'spec004-value-a',
  createTime: '2026-11-07 10:00:00',
  remark: '评测夹具',
};

describe('config-page-logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('查询：日期范围写入 params，空白条件被移除，分页参数保留', () => {
    const query = buildConfigQuery(
      {
        configKey: 'spec004.config.key',
        configName: '',
        configType: 'N',
        dateRange: ['2026-11-01', '2026-11-07'],
      },
      PAGE,
    );

    expect(query).toEqual({
      configKey: 'spec004.config.key',
      configType: 'N',
      pageNum: 2,
      pageSize: 20,
      params: { beginTime: '2026-11-01', endTime: '2026-11-07' },
    });
  });

  it('查询：无分页参数时用于导出', () => {
    expect(buildConfigQuery({ configName: ' Spec004 ' })).toEqual({
      configName: ' Spec004 ',
    });
  });

  it('载荷：字段去空格，空备注提交 null，编辑补 configId', () => {
    expect(
      buildConfigSubmitPayload(
        {
          configId: 'ignored',
          configKey: '  spec004.config.key  ',
          configName: '  Spec004 参数  ',
          configType: 'N',
          configValue: '  spec004-value-b  ',
          remark: '   ',
        },
        '900004000000000004',
      ),
    ).toEqual({
      configId: '900004000000000004',
      configKey: 'spec004.config.key',
      configName: 'Spec004 参数',
      configType: 'N',
      configValue: 'spec004-value-b',
      remark: null,
    });
  });

  it('载荷：新增时 configType 缺省为 Y，且不带 configId', () => {
    const payload = buildConfigSubmitPayload({
      configKey: 'spec004.e2e.key',
      configName: 'E2E 参数',
      configValue: 'value-a',
    });

    expect(payload.configType).toBe('Y');
    expect(payload).not.toHaveProperty('configId');
  });

  it('E-07 重复键名不前端拦截：同键名可构造两次载荷', () => {
    const first = buildConfigSubmitPayload({
      configKey: 'spec004.dup.key',
      configName: '重复一',
      configType: 'N',
      configValue: '1',
    });
    const second = buildConfigSubmitPayload({
      configKey: 'spec004.dup.key',
      configName: '重复二',
      configType: 'N',
      configValue: '2',
    });

    expect(first.configKey).toBe(second.configKey);
    expect(first).not.toBe(second);
  });

  it('编辑回显：空备注转为空字符串，configType 保留原值', () => {
    expect(toConfigFormValues({ ...config, remark: null })).toEqual({
      configId: '900004000000000004',
      configKey: 'spec004.config.key',
      configName: 'Spec004 参数',
      configType: 'N',
      configValue: 'spec004-value-a',
      remark: '',
    });
  });

  it('系统内置展示：Y=是、N=否，未知值原样返回', () => {
    expect(configTypeInfo('Y')).toMatchObject({ label: '是' });
    expect(configTypeInfo('N')).toMatchObject({ label: '否' });
    expect(configTypeInfo('X')).toMatchObject({ label: 'X' });
  });

  it('刷新缓存成功后清空会话字典缓存', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    await refreshConfigCache(refresh, clearDictCache);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clearDictCache).toHaveBeenCalledTimes(1);
  });

  it('刷新失败不清空缓存，错误继续抛给页面', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('刷新缓存失败'));

    await expect(refreshConfigCache(refresh, clearDictCache)).rejects.toThrow(
      '刷新缓存失败',
    );
    expect(clearDictCache).not.toHaveBeenCalled();
  });
});

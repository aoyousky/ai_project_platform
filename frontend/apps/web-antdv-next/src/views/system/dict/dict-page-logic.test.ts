import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearDictCache } = vi.hoisted(() => ({
  clearDictCache: vi.fn(),
}));

vi.mock('#/composables/use-dict', () => ({
  clearDictCache,
}));

import type { DictData, DictType } from '#/api/system/dict/types';

import {
  buildDictDataQuery,
  buildDictDataSubmitPayload,
  buildDictTypeQuery,
  buildDictTypeSubmitPayload,
  nextDictDataRowCount,
  refreshDictCache,
  resolveDictDataPageContext,
  toDictDataFormValues,
  toDictTypeFormValues,
} from './dict-page-logic';

const PAGE = { currentPage: 2, pageSize: 20 };

const type: DictType = {
  createTime: null,
  dictId: '900004000000000001',
  dictName: 'Spec004 字典类型',
  dictType: 'spec004_dict_type',
  remark: null,
};

const data: DictData = {
  createTime: '2026-11-07 10:00:00',
  cssClass: null,
  dictCode: '900004000000000002',
  dictLabel: 'Spec004 标签一',
  dictSort: 1,
  dictType: 'spec004_dict_type',
  dictValue: 'spec004_value_a',
  isDefault: 'N',
  listClass: 'primary',
  remark: '评测夹具',
};

describe('dict-page-logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('类型查询：日期范围写入 params，空白条件被移除', () => {
    const query = buildDictTypeQuery(
      {
        dictName: '',
        dictType: 'spec004_dict_type',
        dateRange: ['2026-11-01', '2026-11-07'],
      },
      PAGE,
    );

    expect(query).toEqual({
      dictType: 'spec004_dict_type',
      pageNum: 2,
      pageSize: 20,
      params: { beginTime: '2026-11-01', endTime: '2026-11-07' },
    });
  });

  it('类型查询：无分页参数时用于导出', () => {
    expect(buildDictTypeQuery({ dictName: ' Spec004 ' })).toEqual({
      dictName: ' Spec004 ',
    });
  });

  it('数据查询：dictType 固定为当前所选类型，不写入表单值', () => {
    const query = buildDictDataQuery(
      { dictLabel: '标签一', dictType: 'should_not_override' },
      PAGE,
      'spec004_dict_type',
    );

    expect(query).toEqual({
      dictLabel: '标签一',
      dictType: 'spec004_dict_type',
      pageNum: 2,
      pageSize: 20,
    });
  });

  it('类型载荷：名称/类型去空格，空备注提交 null，编辑补 dictId', () => {
    expect(
      buildDictTypeSubmitPayload(
        {
          dictId: 'ignored',
          dictName: '  新字典  ',
          dictType: '  spec004_new  ',
          remark: '   ',
        },
        '900004000000000001',
      ),
    ).toEqual({
      dictId: '900004000000000001',
      dictName: '新字典',
      dictType: 'spec004_new',
      remark: null,
    });
  });

  it('数据载荷：不提交 isDefault，空样式提交 null，排序转数字', () => {
    const payload = buildDictDataSubmitPayload(
      {
        cssClass: '',
        dictCode: 'ignored',
        dictLabel: '  新标签  ',
        dictSort: '3',
        dictType: 'spec004_dict_type',
        dictValue: '  spec004_new_value  ',
        isDefault: 'Y',
        listClass: '',
        remark: '',
      },
      '900004000000000002',
    );

    expect(payload).toEqual({
      cssClass: null,
      dictCode: '900004000000000002',
      dictLabel: '新标签',
      dictSort: 3,
      dictType: 'spec004_dict_type',
      dictValue: 'spec004_new_value',
      listClass: null,
      remark: null,
    });
    expect(payload).not.toHaveProperty('isDefault');
  });

  it('数据载荷：新增时不带 dictCode，dictSort 缺省为 0', () => {
    const payload = buildDictDataSubmitPayload({
      dictLabel: '新标签',
      dictType: 'spec004_dict_type',
      dictValue: 'spec004_new_value',
    });

    expect(payload.dictSort).toBe(0);
    expect(payload).not.toHaveProperty('dictCode');
  });

  it('详情回显：空字段转为表单可编辑值', () => {
    expect(toDictTypeFormValues(type)).toEqual({
      dictId: '900004000000000001',
      dictName: 'Spec004 字典类型',
      dictType: 'spec004_dict_type',
      remark: '',
    });
    expect(toDictDataFormValues(data)).toMatchObject({
      cssClass: '',
      dictCode: '900004000000000002',
      dictLabel: 'Spec004 标签一',
      dictSort: 1,
      listClass: 'primary',
      remark: '评测夹具',
    });
  });

  it('隐藏页上下文：dictId → dictType；无效类型返回 null', () => {
    expect(resolveDictDataPageContext(type)).toEqual({
      dictId: '900004000000000001',
      dictType: 'spec004_dict_type',
    });
    expect(resolveDictDataPageContext(null)).toBeNull();
    expect(
      resolveDictDataPageContext({
        ...type,
        dictId: '',
        dictType: '',
      }),
    ).toBeNull();
  });

  it('A-01 右侧行数：新增 +1、修改不变、删除 -1', () => {
    expect(nextDictDataRowCount(2, 'add')).toBe(3);
    expect(nextDictDataRowCount(3, 'edit')).toBe(3);
    expect(nextDictDataRowCount(3, 'remove')).toBe(2);
    expect(nextDictDataRowCount(3, 'remove', 2)).toBe(1);
  });

  it('E-34 刷新缓存成功后才清空会话字典缓存', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    await refreshDictCache(refresh, clearDictCache);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clearDictCache).toHaveBeenCalledTimes(1);
  });

  it('E-34 刷新失败不清空缓存，错误继续抛给页面', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('刷新缓存失败'));

    await expect(refreshDictCache(refresh, clearDictCache)).rejects.toThrow(
      '刷新缓存失败',
    );
    expect(clearDictCache).not.toHaveBeenCalled();
  });
});

import type {
  DictData,
  DictDataForm,
  DictDataQuery,
  DictType,
  DictTypeForm,
  DictTypeQuery,
} from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

/**
 * 字典 API（SPEC-004 §2、contracts/backend-api-consumed.md §2–§3）。
 *
 * - 分页响应由适配层解包为 `{rows,total}`；
 * - 导出失败仍可能 HTTP 200 + JSON，统一走 `downloadBlob`；
 * - 删除使用逗号分隔 ID，ID 一律先归一化为字符串（E-30）。
 */
export { getDictDataByTypeApi } from '#/api/system/common';

export type * from './types';

/** 字典类型分页列表 */
export async function getDictTypeListApi(
  query: DictTypeQuery,
): Promise<PageResult<DictType>> {
  return requestClient.get<PageResult<DictType>>('/system/dict/type/list', {
    params: query,
  });
}

/** 字典类型详情（隐藏字典数据页据此取 `dictType`） */
export async function getDictTypeApi(dictId: Id): Promise<DictType> {
  return requestClient.get<DictType>(`/system/dict/type/${dictId}`);
}

/** 字典类型选项（无权限码要求，供下拉框使用） */
export async function optionselectDictTypeApi(): Promise<DictType[]> {
  return requestClient.get<DictType[]>('/system/dict/type/optionselect');
}

/** 新增字典类型 */
export async function addDictTypeApi(data: DictTypeForm): Promise<void> {
  return requestClient.post('/system/dict/type', data);
}

/** 修改字典类型 */
export async function updateDictTypeApi(data: DictTypeForm): Promise<void> {
  return requestClient.put('/system/dict/type', data);
}

/** 批量删除字典类型（逗号分隔） */
export async function deleteDictTypeApi(dictIds: Array<Id>): Promise<void> {
  return requestClient.delete(
    `/system/dict/type/${normalizeIds(dictIds).join(',')}`,
  );
}

/** 刷新字典缓存（成功后调用方清空会话字典缓存，E-34） */
export async function refreshDictTypeCacheApi(): Promise<void> {
  return requestClient.delete('/system/dict/type/refreshCache');
}

/** 导出字典类型 */
export async function exportDictTypeApi(query: DictTypeQuery): Promise<void> {
  return downloadBlob('/system/dict/type/export', {
    fileName: '字典类型.xlsx',
    params: query,
  });
}

/** 字典数据分页列表 */
export async function getDictDataListApi(
  query: DictDataQuery,
): Promise<PageResult<DictData>> {
  return requestClient.get<PageResult<DictData>>('/system/dict/data/list', {
    params: query,
  });
}

/** 字典数据详情 */
export async function getDictDataApi(dictCode: Id): Promise<DictData> {
  return requestClient.get<DictData>(`/system/dict/data/${dictCode}`);
}

/** 新增字典数据 */
export async function addDictDataApi(data: DictDataForm): Promise<void> {
  return requestClient.post('/system/dict/data', data);
}

/** 修改字典数据 */
export async function updateDictDataApi(data: DictDataForm): Promise<void> {
  return requestClient.put('/system/dict/data', data);
}

/** 批量删除字典数据（逗号分隔） */
export async function deleteDictDataApi(dictCodes: Array<Id>): Promise<void> {
  return requestClient.delete(
    `/system/dict/data/${normalizeIds(dictCodes).join(',')}`,
  );
}

/** 导出字典数据 */
export async function exportDictDataApi(query: DictDataQuery): Promise<void> {
  return downloadBlob('/system/dict/data/export', {
    fileName: '字典数据.xlsx',
    params: query,
  });
}

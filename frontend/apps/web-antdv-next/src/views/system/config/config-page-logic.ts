/**
 * 参数页可测逻辑（SPEC-004 A-03 / E-07 / E-09 / E-10）。
 *
 * 查询组装、载荷映射、内置标记展示与缓存清理顺序放在这里，页面只负责渲染
 * 与请求调度。`configKey` 允许重复，本模块不做唯一性校验。
 */
import type {
  Config,
  ConfigForm,
  ConfigQuery,
} from '#/api/system/config/types';

import { clearDictCache } from '#/composables/use-dict';
import { addDateRange, removeEmptyParams } from '#/utils/system/query';

interface PageParam {
  currentPage: number;
  pageSize: number;
}

function toPageParams(page?: PageParam) {
  return page
    ? { pageNum: page.currentPage, pageSize: page.pageSize }
    : {};
}

/** 查询：搜索表单 + 日期范围 + 分页；无分页参数时用于导出 */
export function buildConfigQuery(
  formValues: Record<string, any>,
  page?: PageParam,
): ConfigQuery {
  const { dateRange, ...rest } = formValues ?? {};
  return removeEmptyParams(
    addDateRange(
      {
        ...rest,
        ...toPageParams(page),
      },
      dateRange as [string, string] | undefined,
    ),
  ) as ConfigQuery;
}

function trimmedOrNull(value: unknown): null | string {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * 表单值 → 提交体。
 * 新增缺省 `configType='Y'`；编辑保留表单回显的原值；空备注提交 `null`。
 */
export function buildConfigSubmitPayload(
  values: Record<string, any>,
  configId?: number | string,
): ConfigForm {
  const effectiveId = configId ?? values.configId;
  const configType = String(values.configType ?? 'Y').trim() || 'Y';
  const payload: ConfigForm = {
    configKey: String(values.configKey ?? '').trim(),
    configName: String(values.configName ?? '').trim(),
    configType,
    configValue: String(values.configValue ?? '').trim(),
    remark: trimmedOrNull(values.remark),
  };

  if (effectiveId !== undefined && effectiveId !== null) {
    payload.configId = effectiveId;
  }

  return payload;
}

/** 详情 → 表单回显 */
export function toConfigFormValues(config: Config): Record<string, any> {
  return {
    configId: config.configId,
    configKey: config.configKey,
    configName: config.configName,
    configType: config.configType,
    configValue: config.configValue,
    remark: config.remark ?? '',
  };
}

const CONFIG_TYPE_TAG: Record<string, { color: string; label: string }> = {
  N: { color: 'default', label: '否' },
  Y: { color: 'success', label: '是' },
};

/** 系统内置列展示：`Y`/`N` → 是/否；未知值原样返回，不空白 */
export function configTypeInfo(value?: null | string): {
  color: string;
  label: string;
} {
  const key = String(value ?? '');
  return CONFIG_TYPE_TAG[key] ?? { color: 'default', label: key };
}

/**
 * 刷新参数缓存成功后清空会话字典缓存；失败时保持原缓存并抛错（E-34 同理）。
 */
export async function refreshConfigCache(
  refresh: () => Promise<void>,
  clearCache: () => void = clearDictCache,
): Promise<void> {
  await refresh();
  clearCache();
}

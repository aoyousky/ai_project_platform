/**
 * 字典会话级缓存（SPEC-002 A-10）。
 *
 * - 同一 `dictType` 在一次会话内只请求一次；
 * - 并发调用共享同一请求，所有调用方各自持有响应式引用并同步更新；
 * - 已加载的字典直接返回缓存快照，不再请求；
 * - 失败不缓存：请求层已统一提示后端 `msg`，这里清空数据并允许下次重试。
 */
import type { Ref } from 'vue';

import type { DictData } from '#/api/system/common';

import { ref } from 'vue';

import { getDictDataByTypeApi } from '#/api/system/common';

type DictList = DictData[];

/** 已成功加载的字典快照 */
const cache = new Map<string, DictList>();
/** 进行中的请求 → 等待该请求结果的响应式引用 */
const inFlight = new Map<string, Set<Ref<DictList>>>();

function ensureLoaded(dictType: string): Ref<DictList> {
  const target = ref<DictList>(cache.get(dictType) ?? []);

  const subscribers = inFlight.get(dictType);
  if (subscribers) {
    subscribers.add(target);
    return target;
  }

  if (cache.has(dictType)) {
    return target;
  }

  const waiting = new Set<Ref<DictList>>([target]);
  inFlight.set(dictType, waiting);

  getDictDataByTypeApi(dictType).then(
    (list) => {
      const value = list ?? [];
      cache.set(dictType, value);
      inFlight.delete(dictType);
      for (const subscriber of waiting) {
        subscriber.value = value;
      }
    },
    () => {
      // 失败结果不缓存，下一次 useDict 会重新请求
      inFlight.delete(dictType);
      cache.delete(dictType);
      for (const subscriber of waiting) {
        subscriber.value = [];
      }
    },
  );

  return target;
}

/**
 * 获取若干字典类型的响应式数据。
 * 返回对象与入参 dictType 同名，页面直接 `const { sys_normal_disable: statusDict } = useDict(...)`。
 */
export function useDict<T extends string>(
  ...dictTypes: T[]
): Record<T, Ref<DictList>> {
  const result = {} as Record<T, Ref<DictList>>;
  for (const dictType of dictTypes) {
    result[dictType] = ensureLoaded(dictType);
  }
  return result;
}

/** 字典值 → 标签；找不到时返回空串（不把原始值当标签展示） */
export function dictLabel(list: DictList | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const key = String(value);
  return list?.find((item) => item.dictValue === key)?.dictLabel ?? '';
}

/** 清空会话缓存（角色权限切换、登出时调用） */
export function clearDictCache(): void {
  cache.clear();
  inFlight.clear();
}

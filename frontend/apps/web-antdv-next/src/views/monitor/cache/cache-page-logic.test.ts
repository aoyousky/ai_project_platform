import { describe, expect, it } from 'vitest';

import {
  aofText,
  commandSeries,
  cpuText,
  displayValue,
  memoryGaugeOption,
  networkText,
  redisModeText,
} from './cache-page-logic';

/**
 * SPEC-007 §4.2 / data-model.md §3：缓存字段转换与空值语义。
 * `null` 与 `0` 必须分开：`null` 表示未知显示「—」，`0` 是有效值。
 */
describe('cache-page-logic', () => {
  it('空值显示「—」，真实 0 显示 0', () => {
    expect(displayValue(null)).toBe('—');
    expect(displayValue(undefined)).toBe('—');
    expect(displayValue('')).toBe('—');
    expect(displayValue(0)).toBe('0');
    expect(displayValue('0')).toBe('0');
    expect(displayValue(42)).toBe('42');
  });

  it('运行模式：standalone → 单机，其他非空 → 集群，缺键 → —', () => {
    expect(redisModeText('standalone')).toBe('单机');
    expect(redisModeText('cluster')).toBe('集群');
    expect(redisModeText('sentinel')).toBe('集群');
    expect(redisModeText(undefined)).toBe('—');
    expect(redisModeText('')).toBe('—');
  });

  it('aof：0 → 否，其他非空 → 是，缺键 → —', () => {
    expect(aofText('0')).toBe('否');
    expect(aofText('1')).toBe('是');
    expect(aofText(undefined)).toBe('—');
    expect(aofText('')).toBe('—');
  });

  it('cpu：可转数字保留两位小数，不可转回退原值，缺键 → —', () => {
    expect(cpuText('0.123456')).toBe('0.12');
    expect(cpuText('3')).toBe('3.00');
    expect(cpuText('0')).toBe('0.00');
    expect(cpuText('abc')).toBe('abc');
    expect(cpuText(undefined)).toBe('—');
    expect(cpuText('')).toBe('—');
  });

  it('网络：合并为「输入kps/输出kps」，任一侧缺键显示「—」', () => {
    expect(networkText('1.5', '2.25')).toBe('1.5kps/2.25kps');
    expect(networkText('0', '0')).toBe('0kps/0kps');
    expect(networkText(undefined, '2')).toBe('—kps/2kps');
    expect(networkText('1', '')).toBe('1kps/—kps');
  });

  it('命令统计：value 字符串转 number，转换失败按 0，空数组为空序列', () => {
    expect(commandSeries([])).toEqual([]);
    expect(
      commandSeries([
        { name: 'get', value: '120' },
        { name: 'set', value: 'abc' },
        { name: 'del', value: '' },
      ]),
    ).toEqual([
      { name: 'get', value: 120 },
      { name: 'set', value: 0 },
      { name: 'del', value: 0 },
    ]);
  });

  it('内存仪表盘：固定量程、不臆造百分比，展示已用与最大内存文本', () => {
    const option = memoryGaugeOption({
      maxmemory_human: '4.00G',
      used_memory_human: '1.00M',
    });
    const title = option.title as any;
    const series = option.series as any[];

    expect(title.text).toBe('1.00M');
    expect(title.subtext).toBe('最大 4.00G');
    expect(series[0].type).toBe('pie');
    // 无量程刻度百分比可展示：扇区标签关闭，避免把 100% 误读为使用率。
    expect(series[0].data[0].label.show).toBe(false);
    expect(series[0].data[0].value).toBe(100);
  });

  it('内存仪表盘：缺键时展示「—」而不是 0 或空串', () => {
    const option = memoryGaugeOption({});
    const title = option.title as any;

    expect(title.text).toBe('—');
    expect(title.subtext).toBe('最大 —');
  });
});

import { describe, expect, it, vi } from 'vitest';

import { mapMenuIcon } from './icon-map';

/**
 * SPEC-001 §4/§7 与 research R10：后端图标名（plus-ui SVG 资产名）必须映射为
 * iconify 名称；`#` 为占位图标丢弃；未知图标回退 `lucide:circle` 并告警一次。
 */
const CONFIGURED_ICONS = [
  'category',
  'chart',
  'code',
  'dashboard',
  'dict',
  'edit',
  'finish',
  'form',
  'guide',
  'input',
  'international',
  'job',
  'list',
  'log',
  'logininfor',
  'message',
  'monitor',
  'my-copy',
  'my-task',
  'online',
  'peoples',
  'post',
  'process-definition',
  'redis',
  'star',
  'system',
  'tool',
  'tree',
  'tree-table',
  'upload',
  'user',
  'waiting',
  'workflow',
] as const;

describe('R10 菜单图标映射', () => {
  it('`#` 与空值不产生图标', () => {
    expect(mapMenuIcon('#')).toBeUndefined();
    expect(mapMenuIcon(undefined)).toBeUndefined();
    expect(mapMenuIcon('')).toBeUndefined();
  });

  it('按映射表转为 iconify 名称', () => {
    expect(mapMenuIcon('system')).toBe('lucide:settings');
    expect(mapMenuIcon('monitor')).toBe('lucide:activity');
    expect(mapMenuIcon('guide')).toBe('lucide:book-open');
  });

  it('真实 getRouters 中 33 个已配置图标全部命中映射表', () => {
    for (const name of CONFIGURED_ICONS) {
      expect(mapMenuIcon(name), name).not.toBe('lucide:circle');
    }
  });

  it('未知图标回退 lucide:circle，同一名称只告警一次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapMenuIcon('no-such-icon')).toBe('lucide:circle');
    expect(mapMenuIcon('no-such-icon')).toBe('lucide:circle');
    expect(mapMenuIcon('another-unknown')).toBe('lucide:circle');
    // 原型链键不得命中映射表（`meta.icon` 必须是字符串）。
    expect(mapMenuIcon('toString')).toBe('lucide:circle');
    expect(mapMenuIcon('__proto__')).toBe('lucide:circle');
    const calls = warn.mock.calls.map((args) => String(args[0]));
    expect(calls.filter((line) => line.includes('no-such-icon'))).toHaveLength(1);
    expect(calls.filter((line) => line.includes('another-unknown'))).toHaveLength(1);
    warn.mockRestore();
  });
});

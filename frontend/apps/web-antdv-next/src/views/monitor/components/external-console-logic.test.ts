import { describe, expect, it } from 'vitest';

import {
  externalLinkProps,
  isConfigured,
  resolveConsoleUrl,
} from './external-console-logic';

describe('external-console-logic', () => {
  it('未配置：undefined、空串与纯空白均为未配置', () => {
    expect(isConfigured(undefined)).toBe(false);
    expect(isConfigured('')).toBe(false);
    expect(isConfigured('   ')).toBe(false);
  });

  it('已配置：绝对地址与相对路径均视为已配置', () => {
    expect(isConfigured('http://localhost:9090/admin/applications')).toBe(true);
    expect(isConfigured('/admin/applications')).toBe(true);
  });

  it('外链保留配置地址原样，并带 noopener/noreferrer', () => {
    expect(
      externalLinkProps('http://localhost:9090/admin/applications'),
    ).toEqual({
      href: 'http://localhost:9090/admin/applications',
      rel: 'noopener noreferrer',
      target: '_blank',
    });
  });

  it('外链地址为空时不生成可点击地址', () => {
    expect(externalLinkProps(undefined)).toEqual({
      href: '',
      rel: 'noopener noreferrer',
      target: '_blank',
    });
  });
});

describe('外部控制台地址来源', () => {
  const KEY = 'VITE_GLOB_MONITOR_ADMIN_URL';
  const RUNTIME = 'http://localhost:9090/admin/applications';
  const BUILD = 'http://localhost:9090/admin/applications';

  it('生产：优先使用 window 运行时配置', () => {
    expect(resolveConsoleUrl(KEY, { [KEY]: BUILD }, { [KEY]: RUNTIME })).toBe(
      RUNTIME,
    );
  });

  it('运行时配置为空串：按未配置，不回退构建值（E-12）', () => {
    expect(resolveConsoleUrl(KEY, { [KEY]: BUILD }, { [KEY]: '' })).toBe('');
  });

  it('无运行时配置：使用构建环境值（开发态）', () => {
    expect(resolveConsoleUrl(KEY, { [KEY]: BUILD }, undefined)).toBe(BUILD);
  });

  it('运行时与构建值都缺失：返回空串，不提供默认地址', () => {
    expect(resolveConsoleUrl(KEY, {}, {})).toBe('');
    expect(resolveConsoleUrl(KEY, undefined, undefined)).toBe('');
  });
});
